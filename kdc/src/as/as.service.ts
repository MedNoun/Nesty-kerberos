import { Inject, Injectable } from '@nestjs/common';
import { Request1Dto } from './dto/request1.dto';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { Challenge, Payload } from 'src/common/types/response';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class AsService {
  constructor(
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}
  async authenticate(request: Request1Dto, ip: string, realm: string) {
    const userKey = await this.cacheService.get<string>(
      request.username + '@' + realm,
    );
    const serviceKey = await this.cacheService.get<string>(
      request.serviceName + '@' + realm,
    );
    // look for user in the keytab or database
    if (userKey && serviceKey) {
      const challenge = new Challenge(
        request.serviceName,
        new Date().getTime(),
        this.cryptoService.getLifetime(
          request.requestedLifetime,
          await this.cacheService.get<string>('interval' + '@' + realm),
        ),
        '',
      );
      return new Payload(
        challenge,
        request.username,
        realm,
        'tgs',
        ip,
        challenge.lifetime,
        userKey,
      );
    }
  }
}
