import { UnauthorizedException } from '@nestjs/common';
import { CryptoService, KEY_BYTES } from './crypto.service';

describe('CryptoService', () => {
  const service = new CryptoService();
  const key = service.genKey();
  const payload = { username: 'mednoun', timestamp: 1_700_000_000_000 };

  describe('encrypt and decrypt', () => {
    it('round-trips a payload', () => {
      expect(service.decrypt(service.encrypt(payload, key), key)).toEqual(
        payload,
      );
    });

    it('uses a fresh IV for every message', () => {
      const first = service.encrypt(payload, key);
      const second = service.encrypt(payload, key);
      expect(first.iv).not.toEqual(second.iv);
      expect(first.ciphertext).not.toEqual(second.ciphertext);
    });

    it('rejects a tampered ciphertext', () => {
      const envelope = service.encrypt(payload, key);
      envelope.ciphertext = `A${envelope.ciphertext.slice(1)}`;
      expect(() => service.decrypt(envelope, key)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a tampered IV', () => {
      const envelope = service.encrypt(payload, key);
      envelope.iv = service.genKey(12);
      expect(() => service.decrypt(envelope, key)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a tampered authentication tag', () => {
      const envelope = service.encrypt(payload, key);
      envelope.tag = service.genKey(16);
      expect(() => service.decrypt(envelope, key)).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects the wrong key', () => {
      const envelope = service.encrypt(payload, key);
      expect(() => service.decrypt(envelope, service.genKey())).toThrow(
        UnauthorizedException,
      );
    });

    it.each([
      ['a password rather than hex', 'correct horse battery staple'],
      ['hex that is too short', 'abcdef'],
      ['a non-hex character throughout', 'z'.repeat(KEY_BYTES * 2)],
    ])('refuses to encrypt with %s', (_label, badKey) => {
      // Buffer.from(badKey, 'hex') would silently yield a short or empty key.
      expect(() => service.encrypt(payload, badKey)).toThrow(
        /must be 32 bytes of hex/,
      );
    });

    it('reports a bad key on decrypt as an authentication failure', () => {
      const envelope = service.encrypt(payload, key);
      expect(() => service.decrypt(envelope, 'not-a-key')).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an envelope with no ciphertext', () => {
      expect(() =>
        service.decrypt({ ciphertext: '', iv: '', tag: '' }, key),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('string2key', () => {
    it('is deterministic for a principal', () => {
      expect(service.string2key('hunter2hunter2', 'insat', 'mednoun')).toEqual(
        service.string2key('hunter2hunter2', 'insat', 'mednoun'),
      );
    });

    it('produces a 32-byte hex key usable as a cipher key', () => {
      const derived = service.string2key('hunter2hunter2', 'insat', 'mednoun');
      expect(derived).toMatch(/^[0-9a-f]{64}$/);
      expect(
        service.decrypt(service.encrypt(payload, derived), derived),
      ).toEqual(payload);
    });

    it('salts by realm and username, so one password differs per principal', () => {
      const base = service.string2key('hunter2hunter2', 'insat', 'mednoun');
      expect(
        service.string2key('hunter2hunter2', 'enit', 'mednoun'),
      ).not.toEqual(base);
      expect(
        service.string2key('hunter2hunter2', 'insat', 'someone'),
      ).not.toEqual(base);
    });
  });

  describe('getLifetime', () => {
    const interval = { min: 2_000, max: 10_000 };

    it('returns the requested duration when it is inside the policy', () => {
      expect(service.getLifetime(5_000, interval)).toBe(5_000);
    });

    it('raises a short request to the minimum', () => {
      expect(service.getLifetime(1, interval)).toBe(2_000);
    });

    it('caps a long request at the maximum', () => {
      expect(service.getLifetime(999_999, interval)).toBe(10_000);
    });

    it('falls back to the minimum when no duration was requested', () => {
      expect(service.getLifetime(undefined, interval)).toBe(2_000);
    });

    it('returns a duration, not an absolute time', () => {
      // Adding Date.now() in here was applied twice on the AS path.
      expect(service.getLifetime(5_000, interval)).toBeLessThan(Date.now());
    });

    it('throws when the realm has no interval configured', () => {
      expect(() => service.getLifetime(5_000, undefined)).toThrow(
        /no lifetime interval/,
      );
    });
  });
});
