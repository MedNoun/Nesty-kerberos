import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { DhKexchangeController } from './dh-kexchange/dh-kexchange.controller';
import { DhKexchangeModule } from './dh-kexchange/dh-kexchange.module';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: 'localhost',
        port: 5432,
        username: 'postgres',
        password: 'pass123',
        database: 'postgres',
        autoLoadEntities: true, //load modules automatically instead of specifying the entities array
        synchronize: true, //automatically generates a SQL table from all classes with @entity decorator but only for development only disable it in production
        //synchronizes the typeORM entities with the database every time
      }),
    }),
    ConfigModule.forRoot(),
    UserModule,
    DhKexchangeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
