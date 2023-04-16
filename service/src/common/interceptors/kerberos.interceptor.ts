import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
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
  Authenticator,
  Encryption,
  Payload,
  Response,
  Ticket,
} from 'src/common/types/response';
import { Request3Dto } from 'src/tickets-manager/dto/request3.dto';

class IncomingRequest {
  serviceTicket: Encryption;
  authenticator: Encryption;
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
    const { realm } = request.params;
    const payload: IncomingRequest = request.body;
    const newReq: Request3Dto = new Request3Dto();
    const privateKey = await this.cacheService.get<string>(
      process.env.SERVICE_NAME + '@' + realm,
    );

    newReq.serviceTicket = JSON.parse(
      this.cryptoService.decrypt(payload.serviceTicket, privateKey),
    );

    newReq.authenticator = JSON.parse(
      this.cryptoService.decrypt(
        payload.authenticator,
        newReq.serviceTicket.sessionKey,
      ),
    );
    request.body = newReq;

    // *********** format the response ************ //
    return next.handle().pipe(
      map((data: Payload) => {
        const auth = new Authenticator(
          data.challenge.principal,
          new Date().getTime(),
        );
        const resp = new Response(
          this.cryptoService.encrypt(auth, data.challenge.sessionKey),
        );
        return resp;
      }),
    );
  }
}
