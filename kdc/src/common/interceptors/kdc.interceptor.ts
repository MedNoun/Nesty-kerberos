import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { Observable, from, switchMap } from 'rxjs';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { TGS_PRINCIPAL } from 'src/common/kerberos.constants';
import {
  Authenticator,
  Challenge,
  Encryption,
  Payload,
  Response,
  Ticket,
} from 'src/common/types/response';
import { LifetimeInterval } from 'src/common/types/realm';
import { Request2Dto } from 'src/tgs/dto/request2.dto';

/**
 * Shared response half of the KDC: mint a session key, stamp the expiry once,
 * then double-encrypt. The ticket goes under the target principal's long-term
 * key so only that principal can open it, the challenge goes under the client's
 * key so only the client can read the session key.
 */
@Injectable()
export abstract class KdcInterceptor implements NestInterceptor {
  constructor(
    protected readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) protected readonly cacheService: Cache,
  ) {}

  public async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<Response>> {
    await this.prepare(context.switchToHttp().getRequest());
    // switchMap, not map: an async mapper returns a promise, and Express
    // serialises a promise as `{}`, so every response body used to be empty.
    return next
      .handle()
      .pipe(switchMap((payload: Payload) => from(this.shape(payload))));
  }

  /**
   * AS requests arrive in the clear, because the client holds no session key
   * yet. The TGS override decrypts the nested request in place.
   */
  protected async prepare(request: Request): Promise<void> {
    void request;
  }

  private async shape(data: Payload): Promise<Response> {
    const ticketKey = await this.cacheService.get<string>(
      `${data.principal}@${data.realm}`,
    );
    if (!ticketKey) {
      throw new NotFoundException(`Unknown principal ${data.principal}`);
    }
    const interval = await this.cacheService.get<LifetimeInterval>(
      `interval@${data.realm}`,
    );
    const lifetime = this.cryptoService.getLifetime(
      data.requestedLifetime,
      interval,
    );
    // A service ticket must not outlive the ticket that authorised it.
    const expiresAt = Math.min(
      Date.now() + lifetime,
      data.maxExpiry ?? Number.MAX_SAFE_INTEGER,
    );
    const challenge: Challenge = {
      ...data.challenge,
      sessionKey: this.cryptoService.genKey(),
      lifetime: expiresAt,
    };
    const ticket: Ticket = {
      ...challenge,
      username: data.username,
      ip: data.ip,
    };
    return new Response(
      this.cryptoService.encrypt(ticket, ticketKey),
      this.cryptoService.encrypt(challenge, data.clientKey),
    );
  }
}

@Injectable()
export class AsInterceptor extends KdcInterceptor {}

@Injectable()
export class TgsInterceptor extends KdcInterceptor {
  protected async prepare(request: Request): Promise<void> {
    const { realm } = request.params;
    const payload = request.body as {
      tgt?: Encryption;
      authenticator?: Encryption;
      request?: { id: string; requestedLifetime: number };
    };
    if (!payload?.request?.id) {
      throw new BadRequestException('No target service in the request');
    }
    // Existence check only. The ticket is encrypted under this principal's key
    // in shape(), which looks it up again from the payload the handler returns.
    const targetExists = await this.cacheService.get<string>(
      `${payload.request.id}@${realm}`,
    );
    if (!targetExists) {
      throw new NotFoundException('The service required not found');
    }
    const tgsKey = await this.cacheService.get<string>(
      `${TGS_PRINCIPAL}@${realm}`,
    );
    if (!tgsKey) {
      throw new NotFoundException(`Unknown realm ${realm}`);
    }
    // Nested decryption: the TGT opens under the TGS's own long-term key, and
    // the session key inside it opens the client's authenticator. Both throw
    // 401 on a bad tag or malformed plaintext.
    const tgt = this.cryptoService.decrypt<Ticket>(payload.tgt, tgsKey);
    const authenticator = this.cryptoService.decrypt<Authenticator>(
      payload.authenticator,
      tgt.sessionKey,
    );
    const decoded = new Request2Dto();
    decoded.tgt = tgt;
    decoded.authenticator = authenticator;
    decoded.request = payload.request;
    request.body = decoded;
  }
}
