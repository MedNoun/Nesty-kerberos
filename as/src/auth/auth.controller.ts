import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { FirstReqDto } from './dto/firstReq.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}
  @Post('register')
  public register() {}
  @Post('req1')
  public req1(@Body() req1: FirstReqDto) {
    return this.authService.req1(req1);
  }
  @Get('test')
  public async test() {
    return await this.authService.test();
  }
}
