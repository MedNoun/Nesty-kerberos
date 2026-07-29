import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { TgsInterceptor } from 'src/common/interceptors/kdc.interceptor';
import { TgsController } from './tgs.controller';
import { TgsService } from './tgs.service';

@Module({
  imports: [CommonModule],
  controllers: [TgsController],
  providers: [TgsService, TgsInterceptor],
})
export class TgsModule {}
