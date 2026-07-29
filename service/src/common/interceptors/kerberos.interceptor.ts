import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cache } from 'cache-manager';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { CryptoService } from 'src/common/crypto/crypto.service';
import {
  Authenticator,
  Encryption,
  Payload,
  Response,
  Ticket,
} from 'src/common/types/response';
import { Request3Dto } from 'src/tickets-manager/dto/request3.dto';

/**
 * The application service's half of the nested-encryption scheme: the service
 * ticket opens under this service's own long-term key, and the session key
 * inside it opens the client's authenticator.
 */
@Injectable()
export class KerberosInterceptor implements NestInterceptor {
  constructor(
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  public async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<Response>> {
    const request: Request = context.switchToHttp().getRequest();
    const { realm } = request.params;
    const payload = request.body as {
      serviceTicket?: Encryption;
      authenticator?: Encryption;
    };
    const principal = process.env.SERVICE_NAME;
    const privateKey = await this.cacheService.get<string>(
      `${principal}@${realm}`,
    );
    if (!privateKey) {
      throw new NotFoundException(`Unknown realm ${realm}`);
    }
    const serviceTicket = this.cryptoService.decrypt<Ticket>(
      payload?.serviceTicket,
      privateKey,
    );
    // Decrypting under our own key already proves the KDC issued this for us.
    // Asserting it makes the guarantee explicit rather than incidental.
    if (serviceTicket.principal !== principal) {
      throw new UnauthorizedException('Ticket was issued for another service');
    }
    const authenticator = this.cryptoService.decrypt<Authenticator>(
      payload?.authenticator,
      serviceTicket.sessionKey,
    );
    const decoded = new Request3Dto();
    decoded.serviceTicket = serviceTicket;
    decoded.authenticator = authenticator;
    request.body = decoded;

    return next
      .handle()
      .pipe(
        map(
          (data: Payload) =>
            new Response(
              this.cryptoService.encrypt(
                data.authenticator,
                data.challenge.sessionKey,
              ),
            ),
        ),
      );
  }
}
