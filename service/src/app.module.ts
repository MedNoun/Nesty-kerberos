import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { redisStore } from 'cache-manager-redis-store';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CommonModule } from './common/common.module';
import realms from './common/config/realms';
import { TicketsManagerModule } from './tickets-manager/tickets-manager.module';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    TicketsManagerModule,
    CommonModule,
    // realms was imported but never passed to load, so ConfigService held none
    // of it and the realm check in registration had nothing to read.
    ConfigModule.forRoot({ isGlobal: true, load: [realms] }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.POSTGRES_HOST,
        port: +process.env.POSTGRES_PORT,
        username: process.env.POSTGRES_USERNAME,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB,
        autoLoadEntities: true,
        // Schema sync is a development convenience: it drops and rebuilds
        // columns on every boot, which is not something to run against real data.
        synchronize: process.env.NODE_ENV !== 'production',
      }),
    }),
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
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
