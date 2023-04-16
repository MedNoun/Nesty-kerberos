import {
  Body,
  Controller,
  Ip,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { TgsService } from './tgs.service';
import { Request2Dto } from './dto/request2.dto';
import { KerberosInterceptor } from 'src/common/interceptors/kerberos.interceptor';

@Controller('tgs')
export class TgsController {
  constructor(private readonly tgsService: TgsService) {}
  @UseInterceptors(KerberosInterceptor)
  @Post(':realm')
  async serviceTicket(
    @Body() request: Request2Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.tgsService.generateTicket(request, ip, realm);
  }
}
