import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ConfigModule } from '@nestjs/config';
import authConfig from './config/auth.config';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [ConfigModule.forFeature(authConfig), UserModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}
