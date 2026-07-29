import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cache } from 'cache-manager';
import { NO_EXPIRY } from '../kerberos.constants';
import { RealmsConfig } from '../types/realm';

/**
 * Writes the keytab into Redis at boot.
 *
 * Every lookup in the AS, the TGS and the interceptors reads `<principal>@<realm>`
 * and `interval@<realm>` from Redis, but nothing ever wrote them, so a fresh
 * environment answered `undefined` for each and the first request died inside
 * the cipher. The KDC is the single writer; the application service only reads
 * its own key.
 */
@Injectable()
export class KeytabSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(KeytabSeeder.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private readonly cacheService: Cache,
  ) {}

  public async onApplicationBootstrap(): Promise<void> {
    const realms = this.configService.get<RealmsConfig>('realms');
    if (!realms) {
      throw new Error(
        'No realms configured: check that ConfigModule loads realms',
      );
    }
    for (const [realm, config] of Object.entries(realms)) {
      for (const [principal, key] of Object.entries(config.principals)) {
        await this.cacheService.set(principal, key, NO_EXPIRY);
      }
      await this.cacheService.set(
        `interval@${realm}`,
        config.lifetimeInterval,
        NO_EXPIRY,
      );
      this.logger.log(
        `Seeded ${
          Object.keys(config.principals).length
        } principals for realm ${realm}`,
      );
    }
  }
}
