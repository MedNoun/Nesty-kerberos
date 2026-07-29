import { Module } from '@nestjs/common';
import { CommonModule } from 'src/common/common.module';
import { KerberosInterceptor } from 'src/common/interceptors/kerberos.interceptor';
import { TicketsManagerController } from './tickets-manager.controller';
import { TicketsManagerService } from './tickets-manager.service';

@Module({
  imports: [CommonModule],
  controllers: [TicketsManagerController],
  providers: [TicketsManagerService, KerberosInterceptor],
})
export class TicketsManagerModule {}
