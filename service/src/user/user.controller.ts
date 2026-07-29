import { Body, Controller, Param, Post } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { keyExchangeDto } from './dto/keyExchange.dto';
import { UserService } from './user.service';

/**
 * Registration only. The scaffolded findAll/findOne/update/remove routes were
 * unauthenticated CRUD over a credential store and returned placeholder
 * strings, and /user/test ran a key exchange for a hard-coded username and
 * logged the derived secret.
 */
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post('dh')
  async keyExchange(@Body() params: keyExchangeDto) {
    return await this.userService.keyExchange(params);
  }

  @Post(':realm')
  async create(
    @Body() createUserDto: CreateUserDto,
    @Param('realm') realm: string,
  ) {
    return await this.userService.create(createUserDto, realm);
  }
}
