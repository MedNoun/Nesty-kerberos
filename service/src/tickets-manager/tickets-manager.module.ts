import { Module } from '@nestjs/common';
import { TicketsManagerService } from './tickets-manager.service';
import { TicketsManagerController } from './tickets-manager.controller';
import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [CommonModule],
  controllers: [TicketsManagerController],
  providers: [TicketsManagerService],
})
export class TicketsManagerModule {}
