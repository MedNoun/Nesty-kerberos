import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AsModule } from './as/as.module';
import { CommonModule } from './common/common.module';
import realms from './common/config/realms';
import { TgsModule } from './tgs/tgs.module';

@Module({
  imports: [
    AsModule,
    TgsModule,
    CommonModule,
    // realms was never loaded, so ConfigService held no principals and the
    // keytab could only be seeded by hand.
    ConfigModule.forRoot({ isGlobal: true, load: [realms] }),
    CacheModule.registerAsync({
      isGlobal: true,
      // registerAsync, because redisStore is async and node-redis wants its
      // host and port under `socket`, not at the top level.
      useFactory: async () => ({
        // The v3 store's Store interface predates @nestjs/cache-manager's, so
        // the shapes do not line up in types even though they do at runtime.
        store: (await redisStore({
          socket: {
            host: process.env.REDIS_HOST,
            port: +process.env.REDIS_PORT,
          },
          password: process.env.REDIS_PASSWORD,
        })) as unknown as CacheStore,
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
