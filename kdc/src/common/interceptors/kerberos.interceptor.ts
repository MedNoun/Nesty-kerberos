import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { CryptoService } from 'src/common/crypto/crypto.service';
import {
  Encryption,
  Payload,
  Response,
  Ticket,
} from 'src/common/types/response';
import { Request2Dto } from 'src/tgs/dto/request2.dto';
import { Cache } from 'cache-manager';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

class IncomingRequest {
  tgt: Encryption;
  authenticator: Encryption;
  request: {
    id: string;
    requestedLifetime: number;
  };
}

@Injectable()
export class KerberosInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}
  async intercept(context: ExecutionContext, next: CallHandler) {
    // *********** format the request ************ //
    const request: Request = context.switchToHttp().getRequest();
    if (request.originalUrl.includes('tgs')) {
      const { realm } = request.params;
      const payload: IncomingRequest = request.body;
      const newReq: Request2Dto = new Request2Dto();
      const serviceKey = await this.cacheService.get<string>(
        payload.request.id + '@' + realm,
      );

      if (!serviceKey) {
        throw new NotFoundException('The service required not found');
      }
      const privateKey = await this.cacheService.get<string>('tgs@' + realm);

      newReq.tgt = JSON.parse(
        this.cryptoService.decrypt(payload.tgt, privateKey, 'hex'),
      );

      newReq.authenticator = JSON.parse(
        this.cryptoService.decrypt(
          payload.authenticator,
          newReq.tgt.sessionKey,
          'hex',
        ),
      );
      newReq.request = payload.request;
      request.body = newReq;
    }

    // *********** format the response ************ //
    return next.handle().pipe(
      map(async (data: Payload) => {
        const key = await this.cacheService.get<string>(
          data.principal + '@' + data.realm,
        );
        data.challenge.sessionKey = this.cryptoService.genKey(32);
        const ticket: Ticket = {
          ...data.challenge,
          lifetime: this.cryptoService.getLifetime(
            data.lifetime,
            await this.cacheService.get<{ min: number; max: number }>(
              'interval@' + data.realm,
            ),
          ),
          ip: data.ip,
          username: data.username,
        };
        const resp = new Response(
          this.cryptoService.encrypt(ticket, key),
          this.cryptoService.encrypt(
            data.challenge,
            data.clientKey ? data.clientKey : data.challenge.sessionKey,
          ),
        );
        return {
          resp: resp,
          newReq: this.cryptoService.encrypt(
            { username: data.username, timestamp: new Date().getTime() },
            data.challenge.sessionKey,
          ),
          dec_1: this.cryptoService.decrypt(resp.ticket, key),
          dec_2: this.cryptoService.decrypt(
            resp.challenge,
            data.clientKey ? data.clientKey : data.challenge.sessionKey,
          ),
        };
      }),
    );
  }
}
