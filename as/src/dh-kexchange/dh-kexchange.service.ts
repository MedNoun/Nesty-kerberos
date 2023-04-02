import { Injectable } from '@nestjs/common';
import { DiffieHellmanGroup, getDiffieHellman, publicEncrypt } from 'crypto';

class Session {
  private dh_group: DiffieHellmanGroup;
  private key;
  constructor(
    pub_key: string = '8db8d0c817ab44af085a838a40aa28e2e273514b9d6e21a564061ed70c3247cedeb4eea4e9bc90a57d2ce17a12f3ba951cc8676d26fa765fee5f5024ec51c487ecb4e32ec4da68cd303c4792cc29d2371960a1328c82967da57d9bb96145d88ab2251c3763aba309592046b9b9f6614b09329fc76bf0ff1b3061fc7252bdb7f2',
    group: string = 'modp2',
  ) {
    this.dh_group = getDiffieHellman(group);
    this.dh_group.generateKeys();
    this.key = this.dh_group.computeSecret(pub_key, 'hex', 'hex');
  }
  public encrypt(message: string) {
  }
  public decrypt(cypher: string) {}
}
@Injectable()
export class DhKexchangeService {
  private sessions: Session[] = [];
  constructor() {
    const session = new Session();
  }
  connect() {}
}
