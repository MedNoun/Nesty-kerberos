import { BinaryToTextEncoding } from 'crypto';

export class keyExchangeDto {
  username: string;
  publicKey: string;
  group: string;
  encoding: BinaryToTextEncoding;
}
