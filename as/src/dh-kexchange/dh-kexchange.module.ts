import { Module } from '@nestjs/common';
import { DhKexchangeController } from './dh-kexchange.controller';
import { DhKexchangeService } from './dh-kexchange.service';

@Module({
  controllers: [DhKexchangeController],
  providers: [DhKexchangeService],
  exports: [],
})
export class DhKexchangeModule {}
