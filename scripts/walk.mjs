#!/usr/bin/env node
/**
 * Walks the whole flow against both running applications: registration, AS
 * exchange, TGS exchange, AP exchange, then a replay that must be rejected.
 *
 * This is the client side of the protocol, and the only client in the
 * repository. The server used to hand back a ready-made authenticator (and the
 * decrypted ticket next to its ciphertext), which meant no client ever had to
 * do this work.
 *
 *   docker compose up -d
 *   (cd kdc && npm run start:dev) &
 *   (cd service && npm run start:dev) &
 *   node scripts/walk.mjs
 */
import {
  createCipheriv,
  createDecipheriv,
  getDiffieHellman,
  hkdfSync,
  pbkdf2Sync,
  randomBytes,
} from 'node:crypto';

const KDC = process.env.KDC_URL ?? 'http://127.0.0.1:5000';
const SERVICE = process.env.SERVICE_URL ?? 'http://127.0.0.1:3001';
const REALM = 'insat';
const TARGET = 'service_1';
const GROUP = 'modp15';
const HOURS = 60 * 60 * 1000;

// Must match kdc/src/common/crypto/crypto.service.ts.
const CIPHER = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const KDF_ITERATIONS = 600_000;

function encrypt(payload, key) {
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

function decrypt({ ciphertext, iv, tag }, key) {
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
  );
}

/** RFC 4120 salt convention: realm then username. */
function string2key(password, realm, username) {
  return pbkdf2Sync(
    password,
    realm + username,
    KDF_ITERATIONS,
    KEY_BYTES,
    'sha256',
  ).toString('hex');
}

async function post(url, body, { expect = 200 } = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (response.status !== expect) {
    throw new Error(
      `POST ${url} returned ${response.status}, expected ${expect}: ${text}`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

const step = (n, message) => console.log(`${n}. ${message}`);

async function main() {
  const username = `walker_${randomBytes(3).toString('hex')}`;
  const password = 'correct horse battery staple';

  // 1. Registration over ephemeral Diffie-Hellman.
  const group = getDiffieHellman(GROUP);
  group.generateKeys();
  const serverPublicKey = await post(`${SERVICE}/user/dh`, {
    username,
    publicKey: group.getPublicKey('hex'),
    group: GROUP,
  }, { expect: 201 });
  const shared = Buffer.from(
    hkdfSync(
      'sha256',
      group.computeSecret(Buffer.from(serverPublicKey, 'hex')),
      Buffer.from('nesty-kerberos-dh'),
      Buffer.from('registration'),
      KEY_BYTES,
    ),
  ).toString('hex');
  const registered = await post(
    `${SERVICE}/user/${REALM}`,
    {
      username,
      firstname: 'Wal',
      lastname: 'Ker',
      password: encrypt(password, shared),
    },
    { expect: 201 },
  );
  step(1, `registered ${registered.username}@${registered.realm} (id ${registered.id})`);

  // 2. AS exchange. The client derives the same long-term key offline.
  const clientKey = string2key(password, REALM, username);
  const asReply = await post(`${KDC}/as/${REALM}`, {
    username,
    serviceName: TARGET,
    requestedLifetime: 3 * HOURS,
    preAuth: encrypt({ username, timestamp: Date.now() }, clientKey),
  }, { expect: 201 });
  if (asReply.dec_1 || asReply.dec_2 || asReply.newReq) {
    throw new Error('The AS response still carries decrypted debug fields');
  }
  const tgtChallenge = decrypt(asReply.challenge, clientKey);
  step(
    2,
    `AS issued a TGT for ${tgtChallenge.principal}, expires ${new Date(tgtChallenge.lifetime).toISOString()}`,
  );

  // 3. TGS exchange, using the session key recovered from the challenge.
  const tgsReply = await post(`${KDC}/tgs/${REALM}`, {
    tgt: asReply.ticket,
    authenticator: encrypt(
      { username, timestamp: Date.now() },
      tgtChallenge.sessionKey,
    ),
    request: { id: TARGET, requestedLifetime: 3 * HOURS },
  }, { expect: 201 });
  const serviceChallenge = decrypt(tgsReply.challenge, tgtChallenge.sessionKey);
  step(
    3,
    `TGS issued a service ticket for ${serviceChallenge.principal}, expires ${new Date(serviceChallenge.lifetime).toISOString()}`,
  );
  if (serviceChallenge.lifetime > tgtChallenge.lifetime) {
    throw new Error('The service ticket outlives the TGT that authorised it');
  }

  // 4. AP exchange against the application service.
  const apAuthenticator = { username, timestamp: Date.now() };
  const apReply = await post(`${SERVICE}/tickets-manager/${REALM}`, {
    serviceTicket: tgsReply.ticket,
    authenticator: encrypt(apAuthenticator, serviceChallenge.sessionKey),
  }, { expect: 201 });
  const echoed = decrypt(apReply.authenticator, serviceChallenge.sessionKey);
  if (echoed.timestamp !== apAuthenticator.timestamp) {
    throw new Error('AP_REP did not echo the authenticator timestamp');
  }
  step(4, `service accepted the ticket and echoed ${echoed.username}@${echoed.timestamp}`);

  // 5. The same authenticator again must be refused.
  await post(
    `${SERVICE}/tickets-manager/${REALM}`,
    {
      serviceTicket: tgsReply.ticket,
      authenticator: encrypt(apAuthenticator, serviceChallenge.sessionKey),
    },
    { expect: 401 },
  );
  step(5, 'replayed authenticator rejected with 401');

  // 6. A tampered ciphertext must be refused, not mis-parsed.
  const tampered = { ...tgsReply.ticket };
  tampered.ciphertext = `A${tampered.ciphertext.slice(1)}`;
  await post(
    `${SERVICE}/tickets-manager/${REALM}`,
    {
      serviceTicket: tampered,
      authenticator: encrypt(
        { username, timestamp: Date.now() },
        serviceChallenge.sessionKey,
      ),
    },
    { expect: 401 },
  );
  step(6, 'tampered service ticket rejected with 401');

  console.log('\nAll four legs completed, replay and tampering refused.');
}

main().catch((error) => {
  console.error(`\nFAILED: ${error.message}`);
  process.exit(1);
});
