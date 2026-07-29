import { BadRequestException, Injectable } from '@nestjs/common';
import { DiffieHellmanGroup, getDiffieHellman, hkdfSync } from 'crypto';
import { KEY_BYTES } from '../../crypto/crypto.service';

/**
 * Groups the server will speak. The group name used to come straight from the
 * request body, so a caller could pick `modp1` (768-bit) and weaken the
 * exchange it was about to send a password through.
 */
const GROUPS = new Set(['modp15', 'modp16', 'modp17', 'modp18']);

const HKDF_SALT = Buffer.from('nesty-kerberos-dh');
const HKDF_INFO = Buffer.from('registration');

@Injectable()
export class DhService {
  public getPublicKey(groupName: string): {
    group: DiffieHellmanGroup;
    publicKey: string;
  } {
    if (!GROUPS.has(groupName)) {
      throw new BadRequestException(
        `Unsupported group. Use one of: ${[...GROUPS].join(', ')}`,
      );
    }
    const group = getDiffieHellman(groupName);
    group.generateKeys();
    return { group, publicKey: group.getPublicKey('hex') };
  }

  /**
   * Derives a 256-bit key from the shared secret with HKDF.
   *
   * The previous version called `.substring(0, 32)` on the hex form of the
   * secret, which is 16 bytes, not 32, and is raw DH output rather than key
   * material: the leading bytes of a DH secret are not uniformly distributed.
   */
  public deriveKey(group: DiffieHellmanGroup, peerPublicKey: string): string {
    const secret = group.computeSecret(Buffer.from(peerPublicKey, 'hex'));
    return Buffer.from(
      hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, KEY_BYTES),
    ).toString('hex');
  }
}
