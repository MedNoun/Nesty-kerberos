import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { keyExchangeDto } from './dto/keyExchange.dto';

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
  @Get('test')
  test() {
    return this.userService.test();
  }
 
  @Get()
  findAll() {
    return this.userService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.userService.update(+id, updateUserDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userService.remove(+id);
  }
}
