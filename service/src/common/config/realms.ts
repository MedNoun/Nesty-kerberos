import { RealmsConfig } from '../types/realm';

const HOUR_MS = 60 * 60 * 1000;

const REALMS = ['insat', 'enit'];
const PRINCIPALS = ['as', 'tgs', 'service_1', 'service_2'];

const KEY_PATTERN = /^[0-9a-f]{64}$/i;

/**
 * Principal keys come from the environment so both applications resolve the
 * same value. They used to be generated with `genKey(32)` at module load, which
 * gave the KDC and the service a different key on every boot, and one key was a
 * literal committed to the repository.
 */
function requireKey(realm: string, principal: string): string {
  const name = `${realm}_${principal}_KEY`.toUpperCase();
  const value = process.env[name];
  if (!value || !KEY_PATTERN.test(value)) {
    throw new Error(
      `${name} must be 32 bytes of hex. Generate one with: openssl rand -hex 32`,
    );
  }
  return value;
}

export default (): { realms: RealmsConfig } => ({
  realms: Object.fromEntries(
    REALMS.map((realm) => [
      realm,
      {
        lifetimeInterval: { min: 2 * HOUR_MS, max: 10 * HOUR_MS },
        principals: Object.fromEntries(
          PRINCIPALS.map((principal) => [
            `${principal}@${realm}`,
            requireKey(realm, principal),
          ]),
        ),
      },
    ]),
  ),
});
