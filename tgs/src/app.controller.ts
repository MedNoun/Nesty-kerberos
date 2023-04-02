import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { Req2Dto } from './dto/req2.dto';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Post()
  serviceGranting(@Body() incomingRequest: Req2Dto) {
    console.log('hala controller : ', incomingRequest);

    return this.appService.req2(incomingRequest);
  }
}
