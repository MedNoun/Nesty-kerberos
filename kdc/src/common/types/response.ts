import { IsInt, IsNotEmpty, IsString } from 'class-validator';

/**
 * The wire envelope. `algorithm` and `encoding` used to travel with it, which
 * meant the caller chose the cipher; both are now fixed by CryptoService.
 * Ciphertext is base64, the IV and the GCM tag are hex.
 */
export class Encryption {
  constructor(
    public ciphertext: string,
    public iv: string,
    public tag: string,
  ) {}
}

export class Challenge {
  constructor(
    public principal: string,
    public timestamp: number,
    public lifetime: number,
    public sessionKey: string,
  ) {}
}

/** A ticket is a challenge bound to the client that may present it. */
export class Ticket extends Challenge {
  public username: string;
  public ip: string;
}

export class Authenticator {
  constructor(public username: string, public timestamp: number) {}
}

export class Response {
  constructor(public ticket: Encryption, public challenge: Encryption) {}
}

/**
 * What an AS or TGS handler hands back to the KDC interceptor, which mints the
 * session key, stamps the expiry and does the encryption. Internal only: it is
 * never serialised, and `clientKey` must never leave the process.
 */
export interface Payload {
  challenge: Challenge;
  username: string;
  realm: string;
  /** Principal whose long-term key encrypts the ticket. */
  principal: string;
  ip: string;
  requestedLifetime: number;
  /** Key the client half of the response is encrypted under. */
  clientKey: string;
  /** Absolute cap on the new ticket's expiry, so it cannot outlive the TGT. */
  maxExpiry?: number;
}

/** Validated shape of the encrypted fields arriving on the wire. */
export class EncryptionDto {
  @IsString()
  @IsNotEmpty()
  ciphertext: string;

  @IsString()
  @IsNotEmpty()
  iv: string;

  @IsString()
  @IsNotEmpty()
  tag: string;
}

export class TicketDto {
  @IsString()
  @IsNotEmpty()
  principal: string;

  @IsInt()
  timestamp: number;

  @IsInt()
  lifetime: number;

  @IsString()
  @IsNotEmpty()
  sessionKey: string;

  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  ip: string;
}

export class AuthenticatorDto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsInt()
  timestamp: number;
}
