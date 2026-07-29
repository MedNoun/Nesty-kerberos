import { BadRequestException } from '@nestjs/common';
import { getDiffieHellman } from 'crypto';
import { DhService } from './dh.service';

describe('DhService', () => {
  const service = new DhService();

  it('derives the same 32-byte key on both sides of the exchange', () => {
    const client = getDiffieHellman('modp15');
    client.generateKeys();
    const { group, publicKey } = service.getPublicKey('modp15');

    const serverSide = service.deriveKey(group, client.getPublicKey('hex'));
    const clientSide = service.deriveKey(client, publicKey);

    expect(serverSide).toEqual(clientSide);
    // The old version took .substring(0, 32) of a hex string, which is 16
    // bytes, and used raw DH output rather than derived key material.
    expect(serverSide).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a fresh keypair per exchange', () => {
    expect(service.getPublicKey('modp15').publicKey).not.toEqual(
      service.getPublicKey('modp15').publicKey,
    );
  });

  it.each(['modp1', 'modp2', 'modp14', 'nonsense'])(
    'refuses group %s',
    (group) => {
      expect(() => service.getPublicKey(group)).toThrow(BadRequestException);
    },
  );

  it.each(['modp15', 'modp16', 'modp17', 'modp18'])(
    'accepts group %s',
    (group) => {
      expect(service.getPublicKey(group).publicKey).toMatch(/^[0-9a-f]+$/);
    },
  );
});
