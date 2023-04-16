import { Module } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { DhService } from './services/dh/dh.service';

@Module({
  imports: [],
  providers: [CryptoService, DhService],
  exports: [CryptoService, DhService],
})
export class CommonModule {}
