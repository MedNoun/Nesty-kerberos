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

/** AP_REP: the server echoes the client's authenticator under the session key. */
export class Response {
  constructor(public authenticator: Encryption) {}
}

/**
 * What the tickets manager hands back to the interceptor, which does the
 * encryption. Internal only, never serialised.
 */
export interface Payload {
  challenge: Challenge;
  /** Echoed back to the client to prove the server read the authenticator. */
  authenticator: Authenticator;
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
