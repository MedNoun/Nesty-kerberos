import {
  CallHandler,
  ExecutionContext,
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

class IncomingRequest {
  tgt: Encryption;
  authenticator: Encryption;
  request: {
    id: string;
    requestedLifetime: number;
  };
}

@Injectable()
export class EncryptorInterceptor implements NestInterceptor {
  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request: Request = context.switchToHttp().getRequest();
    if (request.originalUrl.includes('tgs')) {
      const { realm } = request.params;
      const payload: IncomingRequest = request.body;
      const newReq: Request2Dto = new Request2Dto();
      const serviceKey = this.configService
        .get<Map<string, string>>([realm, 'principals'].join('.'))
        .get(payload.request.id);
      if (!serviceKey) {
        throw new NotFoundException('The service required not found');
      }
      const privateKey = this.configService
        .get<Map<string, string>>([realm, 'principals'].join('.'))
        .get('tgs@' + realm);

      newReq.tgt = JSON.parse(
        this.cryptoService.decrypt(
          payload.tgt.ciphertext,
          privateKey,
          payload.tgt.iv,
          payload.tgt.algorithm,
        ),
      );
      newReq.authenticator = JSON.parse(
        this.cryptoService.decrypt(
          payload.authenticator.ciphertext,
          newReq.tgt.sessionKey,
          payload.authenticator.iv,
          payload.authenticator.algorithm,
        ),
      );
      newReq.request = payload.request;
      request.body = newReq;
    }

    return next.handle().pipe(
      map((data: Payload) => {
        const key = this.configService
          .get<Map<string, string>>([data.realm, 'principals'].join('.'))
          .get(data.principal);
        data.challenge.sessionKey = this.cryptoService.genKey(32);
        const ticket: Ticket = {
          ...data.challenge,
          lifetime: this.cryptoService.getLifetime(
            data.lifetime,
            this.configService.get([data.realm, 'lifetimeInterval'].join('.')),
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
          dec_1: this.cryptoService.decrypt(
            resp.ticket.ciphertext,
            key,
            resp.ticket.iv,
          ),
          dec_2: this.cryptoService.decrypt(
            resp.challenge.ciphertext,
            data.clientKey ? data.clientKey : data.challenge.sessionKey,
            resp.challenge.iv,
          ),
          newReq: this.cryptoService.encrypt(
            { username: 'mednoun', timestamp: new Date().getTime() },
            data.challenge.sessionKey,
          ),
        };
      }),
    );
  }
}
