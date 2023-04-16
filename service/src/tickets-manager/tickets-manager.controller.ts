import {
  Body,
  Controller,
  Ip,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { TicketsManagerService } from './tickets-manager.service';
import { Request3Dto } from './dto/request3.dto';
import { KerberosInterceptor } from 'src/common/interceptors/kerberos.interceptor';

@Controller('tickets-manager')
export class TicketsManagerController {
  constructor(private readonly ticketsManagerService: TicketsManagerService) {}
  @UseInterceptors(KerberosInterceptor)
  @Post(':realm')
  async serviceTicket(
    @Body() request: Request3Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.ticketsManagerService.generateTicket(request, ip, realm);
  }
}
