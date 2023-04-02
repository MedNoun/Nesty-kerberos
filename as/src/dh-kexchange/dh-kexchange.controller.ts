import { Controller, Post } from '@nestjs/common';
import { DhKexchangeService } from './dh-kexchange.service';

@Controller('dh-kexchange')
export class DhKexchangeController {
  constructor(private readonly dh: DhKexchangeService) {}
  @Post('/connect')
  public connect() {}
}
