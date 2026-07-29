import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import { randomBytes } from 'crypto';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { NO_EXPIRY } from '../src/common/kerberos.constants';
import { Challenge, Ticket } from '../src/common/types/response';
import {
  Envelope,
  authenticator,
  decrypt,
  encrypt,
  string2key,
  tamper,
} from './kerberos-client';

/**
 * The AS and TGS legs against a live KDC, Redis included.
 *
 * The test holds the TGS and service long-term keys from the environment, which
 * is what lets it read the tickets it is issued and forge ones the KDC should
 * refuse.
 */
describe('AS and TGS exchanges (e2e)', () => {
  const realm = 'insat';
  const target = 'service_1';
  const password = 'correct horse battery staple';
  const lifetime = 3 * 60 * 60 * 1000;

  let app: INestApplication;
  let cache: Cache;
  let username: string;
  let clientKey: string;
  let tgsKey: string;
  let serviceKey: string;

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
    // init() runs the keytab seeder, so the principals exist in Redis.
    await app.init();
    cache = app.get<Cache>(CACHE_MANAGER);
    tgsKey = process.env.INSAT_TGS_KEY;
    serviceKey = process.env.INSAT_SERVICE_1_KEY;
    expect(tgsKey).toMatch(/^[0-9a-f]{64}$/);
  });

  beforeEach(async () => {
    // The KDC has no registration endpoint: a principal is a keytab entry.
    username = `e2e_${randomBytes(4).toString('hex')}`;
    clientKey = string2key(password, realm, username);
    await cache.set(`${username}@${realm}`, clientKey, NO_EXPIRY);
  });

  afterAll(async () => {
    // cache-manager-redis-store does not disconnect on module teardown, so jest
    // would sit on an open handle.
    await (
      cache?.store as unknown as {
        getClient?: () => { quit: () => Promise<unknown> };
      }
    )
      ?.getClient?.()
      ?.quit();
    await app?.close();
  });

  const asRequest = (body: Record<string, unknown> = {}) =>
    request(app.getHttpServer())
      .post(`/as/${realm}`)
      .send({
        username,
        serviceName: target,
        requestedLifetime: lifetime,
        preAuth: encrypt(authenticator(username), clientKey),
        ...body,
      });

  /** Completes the AS leg and returns the TGT plus the challenge inside it. */
  const getTgt = async (): Promise<{
    ticket: Envelope;
    challenge: Challenge;
  }> => {
    const response = await asRequest().expect(201);
    return {
      ticket: response.body.ticket,
      challenge: decrypt<Challenge>(response.body.challenge, clientKey),
    };
  };

  describe('AS exchange', () => {
    it('returns only the ticket and the challenge', async () => {
      const response = await asRequest().expect(201);
      // dec_1, dec_2 and newReq used to sit alongside their own ciphertexts.
      expect(Object.keys(response.body).sort()).toEqual([
        'challenge',
        'ticket',
      ]);
      expect(JSON.stringify(response.body)).not.toContain(password);
    });

    it('issues a TGT the client can open with its long-term key', async () => {
      const { challenge } = await getTgt();
      expect(challenge.principal).toBe('tgs');
      expect(challenge.sessionKey).toMatch(/^[0-9a-f]{64}$/);
      expect(challenge.lifetime).toBeGreaterThan(Date.now());
    });

    it('honours the requested lifetime instead of forcing the maximum', async () => {
      // The clamp used to run twice, so every ticket came back at 10 hours.
      const { challenge } = await getTgt();
      const granted = challenge.lifetime - Date.now();
      expect(granted).toBeLessThanOrEqual(lifetime);
      expect(granted).toBeGreaterThan(lifetime - 60_000);
    });

    it('encrypts the ticket under the TGS key, not the client key', async () => {
      const { ticket, challenge } = await getTgt();
      const tgt = decrypt<Ticket>(ticket, tgsKey);
      expect(tgt.principal).toBe('tgs');
      expect(tgt.username).toBe(username);
      expect(tgt.sessionKey).toBe(challenge.sessionKey);
      expect(tgt.ip).toBeTruthy();
      expect(() => decrypt<Ticket>(ticket, clientKey)).toThrow();
    });

    it('rejects a request with no pre-authenticator', async () => {
      const response = await request(app.getHttpServer())
        .post(`/as/${realm}`)
        .send({ username, serviceName: target, requestedLifetime: lifetime });
      expect(response.status).toBe(400);
    });

    it('rejects a pre-authenticator under the wrong key', async () => {
      await asRequest({
        preAuth: encrypt(
          authenticator(username),
          string2key('wrong', realm, username),
        ),
      }).expect(401);
    });

    it('rejects an unknown principal', async () => {
      await asRequest({ username: 'nobody-here' }).expect(401);
    });

    it('rejects an unknown target service', async () => {
      await asRequest({ serviceName: 'no-such-service' }).expect(401);
    });
  });

  describe('TGS exchange', () => {
    const tgsRequest = (body: Record<string, unknown>) =>
      request(app.getHttpServer())
        .post(`/tgs/${realm}`)
        .send({
          request: { id: target, requestedLifetime: lifetime },
          ...body,
        });

    /** Builds a TGT the KDC will accept, with fields we choose. */
    const forgeTgt = (overrides: Partial<Ticket>, ip: string): Envelope =>
      encrypt(
        {
          principal: 'tgs',
          timestamp: Date.now(),
          lifetime: Date.now() + lifetime,
          sessionKey: 'c'.repeat(64),
          username,
          ip,
          ...overrides,
        },
        tgsKey,
      );

    it('issues a service ticket the target service can open', async () => {
      const { ticket, challenge } = await getTgt();
      const response = await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(authenticator(username), challenge.sessionKey),
      }).expect(201);

      const serviceTicket = decrypt<Ticket>(response.body.ticket, serviceKey);
      expect(serviceTicket.principal).toBe(target);
      expect(serviceTicket.username).toBe(username);
      const clientHalf = decrypt<Challenge>(
        response.body.challenge,
        challenge.sessionKey,
      );
      expect(clientHalf.sessionKey).toBe(serviceTicket.sessionKey);
      // The client half must not be readable with the key it carries.
      expect(clientHalf.sessionKey).not.toBe(challenge.sessionKey);
    });

    it('never lets a service ticket outlive the TGT', async () => {
      const { ticket, challenge } = await getTgt();
      const response = await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(authenticator(username), challenge.sessionKey),
      }).expect(201);
      const serviceTicket = decrypt<Ticket>(response.body.ticket, serviceKey);
      expect(serviceTicket.lifetime).toBeLessThanOrEqual(challenge.lifetime);
    });

    it('rejects a replayed authenticator', async () => {
      const { ticket, challenge } = await getTgt();
      const replayed = encrypt(authenticator(username), challenge.sessionKey);
      await tgsRequest({ tgt: ticket, authenticator: replayed }).expect(201);
      await tgsRequest({ tgt: ticket, authenticator: replayed }).expect(401);
    });

    it('accepts a second, fresh authenticator on the same TGT', async () => {
      const { ticket, challenge } = await getTgt();
      await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(
          authenticator(username, Date.now() - 1_000),
          challenge.sessionKey,
        ),
      }).expect(201);
      await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(authenticator(username), challenge.sessionKey),
      }).expect(201);
    });

    it('rejects a tampered TGT', async () => {
      const { ticket, challenge } = await getTgt();
      await tgsRequest({
        tgt: tamper(ticket),
        authenticator: encrypt(authenticator(username), challenge.sessionKey),
      }).expect(401);
    });

    it('rejects an authenticator under a key that is not the session key', async () => {
      const { ticket } = await getTgt();
      await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(authenticator(username), 'd'.repeat(64)),
      }).expect(401);
    });

    it('rejects an expired TGT', async () => {
      const { ticket } = await getTgt();
      const ip = decrypt<Ticket>(ticket, tgsKey).ip;
      const expired = forgeTgt({ lifetime: Date.now() - 1 }, ip);
      await tgsRequest({
        tgt: expired,
        authenticator: encrypt(authenticator(username), 'c'.repeat(64)),
      }).expect(401);
    });

    it('rejects a TGT bound to another address', async () => {
      const elsewhere = forgeTgt({}, '10.0.0.9');
      await tgsRequest({
        tgt: elsewhere,
        authenticator: encrypt(authenticator(username), 'c'.repeat(64)),
      }).expect(401);
    });

    it('rejects a username in the authenticator that differs from the ticket', async () => {
      const { ticket } = await getTgt();
      const ip = decrypt<Ticket>(ticket, tgsKey).ip;
      const forged = forgeTgt({}, ip);
      await tgsRequest({
        tgt: forged,
        authenticator: encrypt(authenticator('someone-else'), 'c'.repeat(64)),
      }).expect(401);
    });

    it('rejects a ticket that was not issued for the TGS', async () => {
      const { ticket } = await getTgt();
      const ip = decrypt<Ticket>(ticket, tgsKey).ip;
      const notATgt = forgeTgt({ principal: 'service_2' }, ip);
      await tgsRequest({
        tgt: notATgt,
        authenticator: encrypt(authenticator(username), 'c'.repeat(64)),
      }).expect(401);
    });

    it('rejects a request for an unknown service', async () => {
      const { ticket, challenge } = await getTgt();
      await tgsRequest({
        tgt: ticket,
        authenticator: encrypt(authenticator(username), challenge.sessionKey),
        request: { id: 'no-such-service', requestedLifetime: lifetime },
      }).expect(404);
    });
  });
});
