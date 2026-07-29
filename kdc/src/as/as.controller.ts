import {
  Body,
  Controller,
  Ip,
  Param,
  Post,
  UseInterceptors,
} from '@nestjs/common';
import { AsInterceptor } from 'src/common/interceptors/kdc.interceptor';
import { AsService } from './as.service';
import { Request1Dto } from './dto/request1.dto';

@Controller('as')
export class AsController {
  constructor(private readonly asService: AsService) {}

  @UseInterceptors(AsInterceptor)
  @Post(':realm')
  public async authenticate(
    @Body() request: Request1Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.asService.authenticate(request, ip, realm);
  }
}
