import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReplayCacheService } from 'src/common/cache/replay-cache.service';
import { SKEW_MS, TGS_PRINCIPAL } from 'src/common/kerberos.constants';
import { Request2Dto } from './dto/request2.dto';
import { TgsService } from './tgs.service';

describe('TgsService', () => {
  const realm = 'insat';
  const ip = '127.0.0.1';
  const username = 'mednoun';
  const sessionKey = 'a'.repeat(64);

  let service: TgsService;
  let seen: Set<string>;

  beforeEach(async () => {
    seen = new Set<string>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TgsService,
        {
          provide: ReplayCacheService,
          // Stands in for SET NX: records the key, reports a second sighting.
          useValue: {
            isReplay: async (key: string) => {
              if (seen.has(key)) {
                return true;
              }
              seen.add(key);
              return false;
            },
          },
        },
      ],
    }).compile();
    service = module.get<TgsService>(TgsService);
  });

  const requestFor = (
    overrides: {
      tgt?: Partial<Request2Dto['tgt']>;
      authenticator?: Partial<Request2Dto['authenticator']>;
    } = {},
  ): Request2Dto => ({
    tgt: {
      principal: TGS_PRINCIPAL,
      timestamp: Date.now(),
      lifetime: Date.now() + 3_600_000,
      sessionKey,
      username,
      ip,
      ...overrides.tgt,
    },
    authenticator: {
      username,
      timestamp: Date.now(),
      ...overrides.authenticator,
    },
    request: { id: 'service_1', requestedLifetime: 5_000 },
  });

  it('issues a service ticket payload for a valid request', async () => {
    const request = requestFor();
    const payload = await service.generateTicket(request, ip, realm);
    expect(payload.principal).toBe('service_1');
    expect(payload.username).toBe(username);
    expect(payload.clientKey).toBe(sessionKey);
    // A service ticket cannot outlive the ticket that authorised it.
    expect(payload.maxExpiry).toBe(request.tgt.lifetime);
  });

  it('rejects a ticket that was not issued for the TGS', async () => {
    await expect(
      service.generateTicket(
        requestFor({ tgt: { principal: 'service_2' } }),
        ip,
        realm,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a ticket presented from another address', async () => {
    await expect(
      service.generateTicket(requestFor(), '10.0.0.9', realm),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a username mismatch between ticket and authenticator', async () => {
    await expect(
      service.generateTicket(
        requestFor({ authenticator: { username: 'someone-else' } }),
        ip,
        realm,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an expired ticket', async () => {
    await expect(
      service.generateTicket(
        requestFor({ tgt: { lifetime: Date.now() - 1 } }),
        ip,
        realm,
      ),
    ).rejects.toThrow(UnauthorizedException);
  });

  it.each([
    ['too old', -SKEW_MS - 1_000],
    ['too far ahead', SKEW_MS + 1_000],
  ])(
    'rejects an authenticator %s against the server clock',
    async (_label, drift) => {
      await expect(
        service.generateTicket(
          requestFor({ authenticator: { timestamp: Date.now() + drift } }),
          ip,
          realm,
        ),
      ).rejects.toThrow(UnauthorizedException);
    },
  );

  it('accepts an authenticator far from the ticket issue time', async () => {
    // The old check compared the authenticator to the ticket's own timestamp,
    // so a captured authenticator stayed valid for the ticket's whole life.
    const request = requestFor({
      tgt: { timestamp: Date.now() - 60 * 60 * 1000 },
    });
    await expect(
      service.generateTicket(request, ip, realm),
    ).resolves.toBeDefined();
  });

  it('rejects a replayed authenticator', async () => {
    const request = requestFor();
    await service.generateTicket(request, ip, realm);
    await expect(service.generateTicket(request, ip, realm)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('still accepts a fresh authenticator from the same principal', async () => {
    // The replay cache used to be keyed on the username with the ticket's
    // remaining lifetime as its TTL, which locked a user out for hours.
    await service.generateTicket(
      requestFor({ authenticator: { timestamp: Date.now() - 1_000 } }),
      ip,
      realm,
    );
    await expect(
      service.generateTicket(
        requestFor({ authenticator: { timestamp: Date.now() } }),
        ip,
        realm,
      ),
    ).resolves.toBeDefined();
  });
});
