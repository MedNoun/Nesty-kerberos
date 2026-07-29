import { Injectable, UnauthorizedException } from '@nestjs/common';
import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';
import { Encryption } from '../types/response';
import { LifetimeInterval } from '../types/realm';

/**
 * AES-256-GCM with a fresh 96-bit IV per message.
 *
 * The algorithm is fixed here rather than carried in the envelope. Reading it
 * off the wire let the peer choose the mode and the key length, so an
 * unauthenticated caller could downgrade every exchange.
 */
export const CIPHER = 'aes-256-gcm';
export const KEY_BYTES = 32;
export const IV_BYTES = 12;
export const TAG_BYTES = 16;

/** PBKDF2 work factor for string2key, per OWASP guidance for HMAC-SHA256. */
export const KDF_ITERATIONS = 600_000;

const HEX = /^[0-9a-f]+$/i;

@Injectable()
export class CryptoService {
  public encrypt(payload: unknown, key: string): Encryption {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(CIPHER, this.assertKey(key), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(payload), 'utf8'),
      cipher.final(),
    ]);
    return new Encryption(
      ciphertext.toString('base64'),
      iv.toString('hex'),
      cipher.getAuthTag().toString('hex'),
    );
  }

  /**
   * Decrypts, verifies the GCM tag and parses in one step, so a forged
   * envelope, a tampered tag and malformed plaintext all surface as the same
   * 401 instead of a 500 that tells the caller which one it was.
   */
  public decrypt<T>(encryption: Encryption, key: string): T {
    try {
      const { ciphertext, iv, tag } = encryption ?? ({} as Encryption);
      if (typeof ciphertext !== 'string' || ciphertext.length === 0) {
        throw new Error('Envelope carries no ciphertext');
      }
      const decipher = createDecipheriv(
        CIPHER,
        this.assertKey(key),
        this.assertHex(iv, IV_BYTES, 'iv'),
      );
      decipher.setAuthTag(this.assertHex(tag, TAG_BYTES, 'tag'));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'base64')),
        decipher.final(),
      ]).toString('utf8');
      return JSON.parse(plaintext) as T;
    } catch {
      throw new UnauthorizedException('Decryption failed');
    }
  }

  /**
   * Kerberos string2key: a principal's long-term key is derived from the
   * password, and the password itself is never stored.
   *
   * The salt is the RFC 4120 convention, realm concatenated with the username,
   * so a client can derive the same key offline. A random per-user salt would
   * resist precomputation better, but it would have to be handed to any
   * unauthenticated caller that asked for it, which is a worse trade.
   */
  public string2key(password: string, realm: string, username: string): string {
    return pbkdf2Sync(
      password,
      realm + username,
      KDF_ITERATIONS,
      KEY_BYTES,
      'sha256',
    ).toString('hex');
  }

  public genKey(bytes: number = KEY_BYTES): string {
    return randomBytes(bytes).toString('hex');
  }

  /**
   * Returns a duration in milliseconds clamped to the realm policy, never an
   * absolute time. The caller stamps the expiry once, when it builds the
   * ticket; the previous version added `Date.now()` here and was applied twice
   * on the AS path, which silently forced every ticket to the maximum.
   */
  public getLifetime(
    requestedLifetime: number,
    interval: LifetimeInterval,
  ): number {
    if (
      typeof interval?.min !== 'number' ||
      typeof interval?.max !== 'number'
    ) {
      throw new Error('Realm has no lifetime interval configured');
    }
    if (!Number.isFinite(requestedLifetime)) {
      return interval.min;
    }
    return Math.min(Math.max(requestedLifetime, interval.min), interval.max);
  }

  private assertKey(key: string): Buffer {
    return this.assertHex(key, KEY_BYTES, 'key');
  }

  /**
   * `Buffer.from(value, 'hex')` stops at the first non-hex character and drops
   * a trailing nibble, both silently. That is how a raw password used to reach
   * the cipher as a zero-byte key, so the length is checked explicitly.
   */
  private assertHex(value: string, bytes: number, label: string): Buffer {
    if (
      typeof value !== 'string' ||
      value.length !== bytes * 2 ||
      !HEX.test(value)
    ) {
      throw new Error(`The ${label} must be ${bytes} bytes of hex`);
    }
    return Buffer.from(value, 'hex');
  }
}
