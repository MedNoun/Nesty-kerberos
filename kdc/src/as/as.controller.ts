import {
  Body,
  Controller,
  Ip,
  Param,
  Post,
  Query,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { AsService } from './as.service';
import { Request1Dto } from './dto/request1.dto';
import { EncryptorInterceptor } from 'src/common/interceptors/encryptor.interceptor';

@Controller('as')
export class AsController {
  constructor(private readonly asService: AsService) {}
  @UseInterceptors(EncryptorInterceptor)
  @Post(':realm')
  public async authenticate(
    @Body() request: Request1Dto,
    @Ip() ip: string,
    @Param('realm') realm: string,
  ) {
    return await this.asService.authenticate(request, ip, realm);
  }
}
