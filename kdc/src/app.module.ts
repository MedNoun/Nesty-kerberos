import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AsModule } from './as/as.module';
import { TgsModule } from './tgs/tgs.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';

@Module({
  imports: [
    AsModule,
    TgsModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
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
