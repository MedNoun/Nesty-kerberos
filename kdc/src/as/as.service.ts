import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { SKEW_MS, TGS_PRINCIPAL } from 'src/common/kerberos.constants';
import { Authenticator, Challenge, Payload } from 'src/common/types/response';
import { Request1Dto } from './dto/request1.dto';

@Injectable()
export class AsService {
  constructor(
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  public async authenticate(
    request: Request1Dto,
    ip: string,
    realm: string,
  ): Promise<Payload> {
    const userKey = await this.cacheService.get<string>(
      `${request.username}@${realm}`,
    );
    const serviceKey = await this.cacheService.get<string>(
      `${request.serviceName}@${realm}`,
    );
    // One message for an unknown user, an unknown service and a bad
    // pre-authenticator, so the endpoint is not an account oracle. The previous
    // version returned undefined here, which surfaced as a 500 further down.
    if (!userKey || !serviceKey) {
      throw new UnauthorizedException('Pre-authentication failed');
    }
    // The decrypt failure is caught and re-thrown with the same message, so a
    // caller cannot tell "no such principal" from "wrong key" by the wording.
    let preAuth: Authenticator;
    try {
      preAuth = this.cryptoService.decrypt<Authenticator>(
        request.preAuth,
        userKey,
      );
    } catch {
      throw new UnauthorizedException('Pre-authentication failed');
    }
    if (
      preAuth?.username !== request.username ||
      !Number.isFinite(preAuth?.timestamp) ||
      Math.abs(Date.now() - preAuth.timestamp) > SKEW_MS
    ) {
      throw new UnauthorizedException('Pre-authentication failed');
    }
    // The interceptor mints the session key and stamps the expiry, so both are
    // placeholders here. Clamping the lifetime in this method as well was the
    // double-clamp that forced every ticket to the realm maximum.
    const challenge = new Challenge(TGS_PRINCIPAL, Date.now(), 0, '');
    return {
      challenge,
      username: request.username,
      realm,
      principal: TGS_PRINCIPAL,
      ip,
      requestedLifetime: request.requestedLifetime,
      clientKey: userKey,
    };
  }
}
