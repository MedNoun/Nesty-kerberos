import { Injectable } from '@nestjs/common';
import {
  BinaryToTextEncoding,
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { Encryption } from '../types/response';

@Injectable()
export class CryptoService {
  public encrypt(
    text: Object,
    key: string,
    algorithm: string = 'aes-256-cbc',
    keyEncoding: BufferEncoding = 'hex',
    inputEncoding: BufferEncoding = 'utf8',
    outputEncoding: BufferEncoding = 'base64',
  ): Encryption {
    const iv = this.genKey(16);
    const ivBuf = Buffer.from(iv, keyEncoding);
    const keyBuffer = Buffer.from(key, keyEncoding);
    const cipher = createCipheriv(algorithm, keyBuffer, ivBuf);
    let encryption = cipher.update(
      JSON.stringify(text),
      inputEncoding,
      outputEncoding,
    );
    encryption += cipher.final(outputEncoding);

    return {
      ciphertext: encryption,
      encoding: outputEncoding,
      algorithm: algorithm,
      iv: iv,
    };
  }
  public decrypt(
    ciphertext: string,
    key: string,
    iv: string,
    algorithm: string = 'aes-256-cbc',
    keyEncoding: BufferEncoding = 'hex',
    inputEncoding: BufferEncoding = 'base64',
    outputEncoding: BufferEncoding = 'utf8',
  ) {
    const ivBuf = Buffer.from(iv, keyEncoding);
    const keyBuffer = Buffer.from(key, keyEncoding);
    const decipher = createDecipheriv(algorithm, keyBuffer, ivBuf);
    const decryption = decipher.update(
      ciphertext,
      inputEncoding,
      outputEncoding,
    );
    return decryption + decipher.final(outputEncoding);
  }
  public hash(
    text: string,
    algorithm: string = 'sha256',
    outputEncoding: BinaryToTextEncoding = 'hex',
  ) {
    return createHash(algorithm).update(String(text)).digest(outputEncoding);
  }
  public genKey(keySize: number, encoding: BufferEncoding = 'hex') {
    return randomBytes(keySize).toString(encoding);
  }
  public getLifetime(requestedLifetime: number, lifetimeInterval) {
    if (requestedLifetime < lifetimeInterval.max) {
      if (requestedLifetime > lifetimeInterval.min) {
        return requestedLifetime + new Date().getTime();
      } else {
        return lifetimeInterval.min + new Date().getTime();
      }
    } else {
      return lifetimeInterval.max + new Date().getTime();
    }
  }
}
