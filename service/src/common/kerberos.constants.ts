/**
 * Clock skew tolerated on an authenticator, and therefore also how long the
 * replay cache has to remember one: outside this window the timestamp check
 * rejects it anyway.
 */
export const SKEW_MS = 120_000;

/**
 * TTL argument meaning "no expiry" for `cache-manager-redis-store`, which
 * calls `SETEX` only when the TTL is truthy. Note that this store takes
 * **seconds**, not milliseconds, so every other TTL here is in seconds.
 */
export const NO_EXPIRY = 0;

/** How long a Diffie-Hellman registration secret stays usable, in seconds. */
export const DH_TTL_SECONDS = 120;

/** The principal a ticket-granting ticket is issued for. */
export const TGS_PRINCIPAL = 'tgs';
