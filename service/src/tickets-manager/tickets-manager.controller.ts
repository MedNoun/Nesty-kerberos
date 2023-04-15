import { Body, Controller, Ip, Param, Post, UseInterceptors } from '@nestjs/common';
import { TicketsManagerService } from './tickets-manager.service';
import { EncryptorInterceptor } from 'src/common/interceptors/encryptor.interceptor';
import { Request3Dto } from './dto/request3.dto';

@Controller('tickets-manager')
export class TicketsManagerController {
  constructor(private readonly ticketsManagerService: TicketsManagerService) {}
  @UseInterceptors(EncryptorInterceptor)
  @Post(':realm')
  async serviceTicket(
    @Body() request: Request3Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.ticketsManagerService.generateTicket(request, ip, realm);
  }

}
