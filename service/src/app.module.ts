import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TicketsManagerModule } from './tickets-manager/tickets-manager.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import realm from './common/config/realms';
import { CacheModule, CacheStore } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import { UserModule } from './user/user.module';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports: [
    TicketsManagerModule,
    CommonModule,
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.HOST,
        port: +process.env.POSTGRES_PORT,
        username: process.env.POSTGRES_USERNAME,
        password: process.env.POSTGRES_PASSWORD,
        autoLoadEntities: true, //load modules automatically instead of specifying the entities array
        synchronize: true, //automatically generates a SQL table from all classes with @entity decorator but only for development only disable it in production
        //synchronizes the typeORM entities with the database every time
      }),
    }),
    CacheModule.register({
      isGlobal: true,
      store: redisStore as unknown as CacheStore,
      host: process.env.REDIS_HOST,
      port: process.env.REDIS_PORT,
      password: process.env.REDIS_PASSWORD,
    }),
    UserModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
