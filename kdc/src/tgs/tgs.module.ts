import { Module } from '@nestjs/common';
import { TgsService } from './tgs.service';
import { TgsController } from './tgs.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TgsController],
  providers: [TgsService],
})
export class TgsModule {}
