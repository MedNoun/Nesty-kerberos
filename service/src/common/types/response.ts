export class Payload {
  constructor(public challenge: Challenge) {}
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
  constructor(public username: string, public timestamp: number) {}
}
export class Response {
  constructor(public authenticator: Encryption) {}
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
