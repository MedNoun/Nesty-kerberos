import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ReplayCacheService } from 'src/common/cache/replay-cache.service';
import { SKEW_MS } from 'src/common/kerberos.constants';
import { Request3Dto } from './dto/request3.dto';
import { TicketsManagerService } from './tickets-manager.service';

describe('TicketsManagerService', () => {
  const realm = 'insat';
  const ip = '127.0.0.1';
  const username = 'mednoun';
  const sessionKey = 'b'.repeat(64);

  let service: TicketsManagerService;
  let seen: Set<string>;

  beforeEach(async () => {
    seen = new Set<string>();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsManagerService,
        {
          provide: ReplayCacheService,
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
    service = module.get<TicketsManagerService>(TicketsManagerService);
  });

  const requestFor = (
    overrides: {
      serviceTicket?: Partial<Request3Dto['serviceTicket']>;
      authenticator?: Partial<Request3Dto['authenticator']>;
    } = {},
  ): Request3Dto => ({
    serviceTicket: {
      principal: 'service_1',
      timestamp: Date.now(),
      lifetime: Date.now() + 3_600_000,
      sessionKey,
      username,
      ip,
      ...overrides.serviceTicket,
    },
    authenticator: {
      username,
      timestamp: Date.now(),
      ...overrides.authenticator,
    },
  });

  it('echoes the client authenticator back under the session key', async () => {
    const request = requestFor();
    const payload = await service.generateTicket(request, ip, realm);
    // RFC 4120 AP_REP returns the client's own timestamp: sending the server's
    // proves nothing beyond holding the session key.
    expect(payload.authenticator.timestamp).toBe(
      request.authenticator.timestamp,
    );
    expect(payload.authenticator.username).toBe(username);
    expect(payload.challenge.sessionKey).toBe(sessionKey);
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
        requestFor({ serviceTicket: { lifetime: Date.now() - 1 } }),
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

  it('rejects a replayed authenticator', async () => {
    const request = requestFor();
    await service.generateTicket(request, ip, realm);
    await expect(service.generateTicket(request, ip, realm)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('still accepts a fresh authenticator from the same principal', async () => {
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
