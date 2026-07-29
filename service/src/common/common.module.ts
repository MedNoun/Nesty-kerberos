import { Module } from '@nestjs/common';
import { ReplayCacheService } from './cache/replay-cache.service';
import { CryptoService } from './crypto/crypto.service';
import { DhService } from './services/dh/dh.service';

@Module({
  imports: [],
  providers: [CryptoService, DhService, ReplayCacheService],
  exports: [CryptoService, DhService, ReplayCacheService],
})
export class CommonModule {}
