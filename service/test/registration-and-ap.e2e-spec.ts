import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import { getDiffieHellman, hkdfSync, randomBytes } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { Authenticator, Ticket } from '../src/common/types/response';
import {
  Envelope,
  authenticator,
  decrypt,
  encrypt,
  string2key,
  tamper,
} from './kerberos-client';

/**
 * Registration and the AP exchange against a live application service, with
 * Redis and Postgres behind it.
 *
 * The service ticket is minted here under the service's own long-term key, which
 * is exactly what the KDC would have produced, so the final leg is exercised
 * without needing the KDC process.
 */
describe('Registration and AP exchange (e2e)', () => {
  const realm = 'insat';
  const password = 'correct horse battery staple';
  const group = 'modp15';

  let app: INestApplication;
  let cache: Cache;
  let serviceKey: string;
  let otherServiceKey: string;
  let principal: string;

  beforeAll(async () => {
    const fixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = fixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    cache = app.get<Cache>(CACHE_MANAGER);
    principal = process.env.SERVICE_NAME;
    serviceKey = process.env[`${realm}_${principal}_KEY`.toUpperCase()];
    otherServiceKey = process.env.INSAT_SERVICE_2_KEY;
    expect(serviceKey).toMatch(/^[0-9a-f]{64}$/);
  });

  afterAll(async () => {
    await (
      cache?.store as unknown as {
        getClient?: () => { quit: () => Promise<unknown> };
      }
    )
      ?.getClient?.()
      ?.quit();
    await app?.close();
  });

  /** Runs the Diffie-Hellman leg and returns the derived secret. */
  const exchange = async (username: string): Promise<string> => {
    const client = getDiffieHellman(group);
    client.generateKeys();
    const response = await request(app.getHttpServer())
      .post('/user/dh')
      .send({ username, publicKey: client.getPublicKey('hex'), group })
      .expect(201);
    return Buffer.from(
      hkdfSync(
        'sha256',
        client.computeSecret(Buffer.from(response.text, 'hex')),
        Buffer.from('nesty-kerberos-dh'),
        Buffer.from('registration'),
        32,
      ),
    ).toString('hex');
  };

  // Not async: callers chain .expect() on the supertest request.
  const register = (username: string, secret: string, body = {}) =>
    request(app.getHttpServer())
      .post(`/user/${realm}`)
      .send({
        username,
        firstname: 'Mohamed',
        lastname: 'Sahnoun',
        password: encrypt(password, secret),
        ...body,
      });

  describe('registration', () => {
    it('stores the derived key in the keytab and never the password', async () => {
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      const secret = await exchange(username);
      const response = await register(username, secret).expect(201);

      expect(response.body).toEqual({
        id: expect.any(Number),
        username,
        realm,
      });
      const stored = await cache.get<string>(`${username}@${realm}`);
      expect(stored).toBe(string2key(password, realm, username));
      expect(stored).not.toContain(password);
    });

    it('consumes the key exchange, so a second registration needs a new one', async () => {
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      const secret = await exchange(username);
      await register(username, secret).expect(201);
      await register(`${username}_two`, secret).expect(403);
    });

    it('rejects a duplicate principal', async () => {
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      await register(username, await exchange(username)).expect(201);
      await register(username, await exchange(username)).expect(409);
    });

    it('rejects a caller-supplied role', async () => {
      // role used to be part of the DTO, which was self-service ADMIN.
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      const secret = await exchange(username);
      await register(username, secret, { role: 10 }).expect(400);
    });

    it('rejects registration with no key exchange', async () => {
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      await register(username, 'f'.repeat(64)).expect(403);
    });

    it('rejects an unknown realm', async () => {
      const username = `e2e_${randomBytes(4).toString('hex')}`;
      const secret = await exchange(username);
      await request(app.getHttpServer())
        .post('/user/nowhere')
        .send({
          username,
          firstname: 'Mohamed',
          lastname: 'Sahnoun',
          password: encrypt(password, secret),
        })
        .expect(400);
    });

    it.each(['modp1', 'modp2', 'nonsense'])(
      'refuses a weak or unknown group %s',
      async (weak) => {
        await request(app.getHttpServer())
          .post('/user/dh')
          .send({ username: 'someone', publicKey: 'ab', group: weak })
          .expect(400);
      },
    );

    it('no longer exposes the debug and CRUD routes', async () => {
      await request(app.getHttpServer()).get('/user/test').expect(404);
      await request(app.getHttpServer()).get('/user').expect(404);
      await request(app.getHttpServer()).get('/user/1').expect(404);
      await request(app.getHttpServer()).delete('/user/1').expect(404);
    });
  });

  describe('AP exchange', () => {
    const username = 'ap_client';
    const sessionKey = 'e'.repeat(64);

    /** A service ticket as the KDC would have issued it. */
    const mintTicket = (
      overrides: Partial<Ticket> = {},
      key = serviceKey,
    ): Envelope =>
      encrypt(
        {
          principal,
          timestamp: Date.now(),
          lifetime: Date.now() + 3_600_000,
          sessionKey,
          username,
          ip: '::ffff:127.0.0.1',
          ...overrides,
        },
        key,
      );

    const apRequest = (serviceTicket: Envelope, auth: Envelope) =>
      request(app.getHttpServer())
        .post(`/tickets-manager/${realm}`)
        .send({ serviceTicket, authenticator: auth });

    it('accepts a valid ticket and echoes the client timestamp', async () => {
      const auth = authenticator(username);
      const response = await apRequest(
        mintTicket(),
        encrypt(auth, sessionKey),
      ).expect(201);

      const echoed = decrypt<Authenticator>(
        response.body.authenticator,
        sessionKey,
      );
      expect(echoed).toEqual(auth);
      expect(Object.keys(response.body)).toEqual(['authenticator']);
    });

    it('rejects a replayed authenticator', async () => {
      const auth = authenticator(username);
      await apRequest(mintTicket(), encrypt(auth, sessionKey)).expect(201);
      await apRequest(mintTicket(), encrypt(auth, sessionKey)).expect(401);
    });

    it('accepts a fresh authenticator from the same principal', async () => {
      await apRequest(
        mintTicket(),
        encrypt(authenticator(username, Date.now() - 1_000), sessionKey),
      ).expect(201);
      await apRequest(
        mintTicket(),
        encrypt(authenticator(username), sessionKey),
      ).expect(201);
    });

    it('rejects a ticket issued for another service', async () => {
      await apRequest(
        mintTicket({ principal: 'service_2' }, otherServiceKey),
        encrypt(authenticator(username), sessionKey),
      ).expect(401);
    });

    it('rejects a tampered ticket', async () => {
      await apRequest(
        tamper(mintTicket()),
        encrypt(authenticator(username), sessionKey),
      ).expect(401);
    });

    it('rejects an expired ticket', async () => {
      await apRequest(
        mintTicket({ lifetime: Date.now() - 1 }),
        encrypt(authenticator(username), sessionKey),
      ).expect(401);
    });

    it('rejects a ticket bound to another address', async () => {
      await apRequest(
        mintTicket({ ip: '10.0.0.9' }),
        encrypt(authenticator(username), sessionKey),
      ).expect(401);
    });

    it('rejects an authenticator naming a different principal', async () => {
      await apRequest(
        mintTicket(),
        encrypt(authenticator('someone-else'), sessionKey),
      ).expect(401);
    });

    it.each([
      ['too old', -180_000],
      ['too far ahead', 180_000],
    ])('rejects an authenticator %s', async (_label, drift) => {
      await apRequest(
        mintTicket(),
        encrypt(authenticator(username, Date.now() + drift), sessionKey),
      ).expect(401);
    });

    it('rejects an authenticator under a key that is not the session key', async () => {
      await apRequest(
        mintTicket(),
        encrypt(authenticator(username), 'd'.repeat(64)),
      ).expect(401);
    });
  });
});
