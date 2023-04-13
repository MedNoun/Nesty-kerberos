import { Module } from '@nestjs/common';
import { AsService } from './as.service';
import { AsController } from './as.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [AsController],
  providers: [AsService],
})
export class AsModule {}
