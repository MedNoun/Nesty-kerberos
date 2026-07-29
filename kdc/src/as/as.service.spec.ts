import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { SKEW_MS, TGS_PRINCIPAL } from 'src/common/kerberos.constants';
import { AsService } from './as.service';
import { Request1Dto } from './dto/request1.dto';

describe('AsService', () => {
  const crypto = new CryptoService();
  const realm = 'insat';
  const username = 'mednoun';
  const ip = '127.0.0.1';
  const userKey = crypto.genKey();
  const serviceKey = crypto.genKey();

  let service: AsService;
  let cache: Map<string, unknown>;

  beforeEach(async () => {
    cache = new Map<string, unknown>([
      [`${username}@${realm}`, userKey],
      [`service_1@${realm}`, serviceKey],
      [`interval@${realm}`, { min: 2_000, max: 10_000 }],
    ]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AsService,
        { provide: CryptoService, useValue: crypto },
        {
          provide: CACHE_MANAGER,
          useValue: { get: async (key: string) => cache.get(key) },
        },
      ],
    }).compile();
    service = module.get<AsService>(AsService);
  });

  const request = (overrides: Partial<Request1Dto> = {}): Request1Dto => ({
    username,
    serviceName: 'service_1',
    requestedLifetime: 5_000,
    preAuth: crypto.encrypt({ username, timestamp: Date.now() }, userKey),
    ...overrides,
  });

  it('issues a payload for the TGS when pre-authentication succeeds', async () => {
    const payload = await service.authenticate(request(), ip, realm);
    expect(payload.principal).toBe(TGS_PRINCIPAL);
    expect(payload.challenge.principal).toBe(TGS_PRINCIPAL);
    expect(payload.username).toBe(username);
    expect(payload.ip).toBe(ip);
    expect(payload.clientKey).toBe(userKey);
    // The interceptor clamps and stamps. Clamping here as well was the double
    // clamp that forced every ticket to the realm maximum.
    expect(payload.requestedLifetime).toBe(5_000);
    expect(payload.challenge.lifetime).toBe(0);
    expect(payload.challenge.sessionKey).toBe('');
  });

  it('rejects an unknown principal', async () => {
    await expect(
      service.authenticate(request({ username: 'ghost' }), ip, realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown target service', async () => {
    await expect(
      service.authenticate(request({ serviceName: 'nope' }), ip, realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a pre-authenticator encrypted under the wrong key', async () => {
    const preAuth = crypto.encrypt(
      { username, timestamp: Date.now() },
      crypto.genKey(),
    );
    await expect(
      service.authenticate(request({ preAuth }), ip, realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a pre-authenticator naming a different principal', async () => {
    const preAuth = crypto.encrypt(
      { username: 'someone-else', timestamp: Date.now() },
      userKey,
    );
    await expect(
      service.authenticate(request({ preAuth }), ip, realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a stale pre-authenticator', async () => {
    const preAuth = crypto.encrypt(
      { username, timestamp: Date.now() - SKEW_MS - 1_000 },
      userKey,
    );
    await expect(
      service.authenticate(request({ preAuth }), ip, realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('gives one error whichever check failed, so it is not an account oracle', async () => {
    const unknownUser = await service
      .authenticate(request({ username: 'ghost' }), ip, realm)
      .catch((error) => error.message);
    const badPreAuth = await service
      .authenticate(
        request({
          preAuth: crypto.encrypt(
            { username, timestamp: Date.now() },
            crypto.genKey(),
          ),
        }),
        ip,
        realm,
      )
      .catch((error) => error.message);
    expect(unknownUser).toEqual(badPreAuth);
  });
});
