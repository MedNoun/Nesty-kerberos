import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TicketsManagerModule } from './tickets-manager/tickets-manager.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import realm from './common/config/realms';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    TicketsManagerModule,
    CommonModule,
    ConfigModule.forRoot({ load: [realm], isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore as unknown as CacheStore,
      host: process.env.REDIS_HOST,
      port: process.env.PORT,
      password: process.env.REDIS_PASSWORD,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
