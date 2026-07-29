import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

/** The slice of the node-redis client this service needs. */
interface SetIfAbsent {
  set(
    key: string,
    value: string,
    options: { NX: true; PX: number },
  ): Promise<string | null>;
}

@Injectable()
export class ReplayCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cacheService: Cache) {}

  /**
   * Records an authenticator and reports whether it had already been seen.
   *
   * `SET NX` decides it in one round trip. A read followed by a write, which is
   * what this used to be, lets two concurrent replays both pass the read.
   */
  public async isReplay(key: string, ttlMs: number): Promise<boolean> {
    const reply = await this.client().set(key, '1', {
      NX: true,
      PX: Math.max(1, Math.ceil(ttlMs)),
    });
    return reply === null;
  }

  private client(): SetIfAbsent {
    const store = this.cacheService.store as unknown as {
      getClient?: () => SetIfAbsent;
    };
    if (typeof store?.getClient !== 'function') {
      throw new Error(
        'The replay cache needs the Redis store: no getClient() on the cache store',
      );
    }
    return store.getClient();
  }
}
