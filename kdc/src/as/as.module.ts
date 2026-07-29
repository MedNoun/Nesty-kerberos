import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { AsInterceptor } from 'src/common/interceptors/kdc.interceptor';
import { AsController } from './as.controller';
import { AsService } from './as.service';

@Module({
  imports: [CommonModule],
  controllers: [AsController],
  providers: [AsService, AsInterceptor],
})
export class AsModule {}
