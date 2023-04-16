import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import {
  BinaryToTextEncoding,
  DiffieHellmanGroup,
  getDiffieHellman,
} from 'crypto';

@Injectable()
export class DhService {
  constructor() {}
  public getPublicKey(
    _group: string,
    keyEncoding: BinaryToTextEncoding = 'hex',
  ) {
    const group = getDiffieHellman(_group);
    group.generateKeys();
    return { group, key: group.getPublicKey(keyEncoding) };
  }
  public generateKey(
    group: DiffieHellmanGroup,
    publicKey: string,
    inputEncoding: BinaryToTextEncoding = 'hex',
    lengthBytes: number = 256 / 4,
    outputEncoding: BinaryToTextEncoding = 'hex',
  ) {
    return group
      .computeSecret(publicKey, inputEncoding, outputEncoding)
      .substring(0, lengthBytes);
  }
}
