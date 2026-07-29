import { IsString, Length } from 'class-validator';

export class keyExchangeDto {
  @IsString()
  @Length(1, 64)
  username: string;

  /** The client's Diffie-Hellman public key, hex. */
  @IsString()
  @Length(1, 2048)
  publicKey: string;

  /**
   * MODP group name. Validated against an allow-list in DhService: the encoding
   * used to be caller-supplied too, and is now fixed to hex on both sides.
   */
  @IsString()
  @Length(1, 16)
  group: string;
}
