import {
  Body,
  Controller,
  Ip,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { TgsInterceptor } from 'src/common/interceptors/kdc.interceptor';
import { Request2Dto } from './dto/request2.dto';
import { TgsService } from './tgs.service';

@Controller('tgs')
export class TgsController {
  constructor(private readonly tgsService: TgsService) {}

  @UseInterceptors(TgsInterceptor)
  @Post(':realm')
  async serviceTicket(
    @Body() request: Request2Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.tgsService.generateTicket(request, ip, realm);
  }
}
