import { Module } from '@nestjs/common';
import { CryptoService } from './crypto/crypto.service';
import { ReplayCacheService } from './cache/replay-cache.service';
import { KeytabSeeder } from './keytab/keytab.seeder';

@Module({
  imports: [],
  providers: [CryptoService, ReplayCacheService, KeytabSeeder],
  exports: [CryptoService, ReplayCacheService],
})
export class CommonModule {}
