import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AsModule } from './as/as.module';
import { TgsModule } from './tgs/tgs.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import realm from './common/config/realms';

@Module({
  imports: [
    AsModule,
    TgsModule,
    CommonModule,
    ConfigModule.forRoot({ load: [realm], isGlobal: true }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
