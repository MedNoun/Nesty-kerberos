import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';

/**
 * The client side of the protocol, for tests.
 *
 * It duplicates CryptoService deliberately: if the tests imported the server's
 * implementation, a change to the wire format would still pass on both sides.
 */
const CIPHER = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KDF_ITERATIONS = 600_000;

export interface Envelope {
  ciphertext: string;
  iv: string;
  tag: string;
}

export function encrypt(payload: unknown, key: string): Envelope {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(CIPHER, Buffer.from(key, 'hex'), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('hex'),
    tag: cipher.getAuthTag().toString('hex'),
  };
}

export function decrypt<T>({ ciphertext, iv, tag }: Envelope, key: string): T {
  const decipher = createDecipheriv(
    CIPHER,
    Buffer.from(key, 'hex'),
    Buffer.from(iv, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return JSON.parse(
    Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64')),
      decipher.final(),
    ]).toString('utf8'),
  ) as T;
}

/** RFC 4120 salt convention: realm then username. */
export function string2key(
  password: string,
  realm: string,
  username: string,
): string {
  return pbkdf2Sync(
    password,
    realm + username,
    KDF_ITERATIONS,
    KEY_BYTES,
    'sha256',
  ).toString('hex');
}

export const authenticator = (username: string, timestamp = Date.now()) => ({
  username,
  timestamp,
});

/** Flips one character of a base64 ciphertext without changing its length. */
export function tamper(envelope: Envelope): Envelope {
  const first = envelope.ciphertext[0] === 'A' ? 'B' : 'A';
  return { ...envelope, ciphertext: `${first}${envelope.ciphertext.slice(1)}` };
}
