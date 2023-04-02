import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Req3Dto } from './dto/req3.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  req3(@Body() incomingRequest: Req3Dto) {
    return this.appService.req3(incomingRequest);
  }
}
