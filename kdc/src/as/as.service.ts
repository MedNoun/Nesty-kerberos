import { Injectable } from '@nestjs/common';
import { Request1Dto } from './dto/request1.dto';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { ConfigService } from '@nestjs/config';
import { Challenge, Payload } from 'src/common/types/response';

@Injectable()
export class AsService {
  constructor(
    private readonly configService: ConfigService,
    private readonly cryptoService: CryptoService,
  ) {}
  async authenticate(request: Request1Dto, ip: string, realm: string) {
    const user = { mednoun: this.cryptoService.genKey(32) };
    const serviceKey = this.configService
      .get<Map<string, string>>([realm, 'principals'].join('.'))
      .get(request.serviceName);
    // look for user in the keytab or database
    if (user && serviceKey) {
      const challenge = new Challenge(
        request.serviceName,
        new Date().getTime(),
        this.cryptoService.getLifetime(
          request.requestedLifetime,
          this.configService.get([realm, 'lifetimeInterval'].join('.')),
        ),
        '',
      );
      return new Payload(
        challenge,
        'mednoun',
        realm,
        'tgs@' + realm,
        ip,
        challenge.lifetime,
        user['mednoun'],
      );
    }
  }
}
