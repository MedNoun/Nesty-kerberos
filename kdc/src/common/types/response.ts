export class Payload {
  constructor(
    public challenge: Challenge,
    public username: string,
    public realm: string,
    public principal: string,
    public ip: string,
    public lifetime: number,
    public clientKey?: string,
  ) {}
}
export class Encryption {
  constructor(
    public ciphertext: string,
    public encoding: BufferEncoding,
    public algorithm: string,
    public iv: string,
  ) {}
}
export class Authenticator {
  constructor(public serviceId: string, public requestedLifetime: number) {}
}
export class Response {
  constructor(public ticket: Encryption, public challenge: Encryption) {}
}
export class Challenge {
  constructor(
    public principal: string,
    public timestamp: number,
    public lifetime: number,
    public sessionKey: string,
  ) {}
}
export class Ticket extends Challenge {
  public username: string;
  public ip: string;
}
