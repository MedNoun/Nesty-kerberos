import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { DhService } from 'src/common/services/dh/dh.service';
import { Roles } from 'src/common/types/roles.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { User } from './entities/user.entity';
import { UserService } from './user.service';

describe('UserService', () => {
  const crypto = new CryptoService();
  const realm = 'insat';
  const username = 'mednoun';
  const password = 'correct horse battery staple';
  const shared = crypto.genKey();

  let service: UserService;
  let cache: Map<string, unknown>;
  let saved: Partial<User>[];
  let existing: User | null;

  beforeEach(async () => {
    cache = new Map<string, unknown>([[`dh@${username}`, shared]]);
    saved = [];
    existing = null;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: CryptoService, useValue: crypto },
        { provide: DhService, useValue: new DhService() },
        {
          provide: ConfigService,
          useValue: {
            get: () => ({ insat: { principals: {}, lifetimeInterval: {} } }),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: async () => existing,
            create: (user: Partial<User>) => user,
            save: async (user: Partial<User>) => {
              saved.push(user);
              return { id: 1, ...user };
            },
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            get: async (key: string) => cache.get(key),
            set: async (key: string, value: unknown) => cache.set(key, value),
            del: async (key: string) => cache.delete(key),
          },
        },
      ],
    }).compile();
    service = module.get<UserService>(UserService);
  });

  const dto = (overrides: Partial<CreateUserDto> = {}): CreateUserDto => ({
    username,
    firstname: 'Mohamed',
    lastname: 'Sahnoun',
    password: crypto.encrypt(password, shared),
    ...overrides,
  });

  it('stores the derived key and never the password', async () => {
    const result = await service.create(dto(), realm);

    const expected = crypto.string2key(password, realm, username);
    expect(saved[0].principalKey).toBe(expected);
    expect(cache.get(`${username}@${realm}`)).toBe(expected);
    expect(JSON.stringify(saved[0])).not.toContain(password);
    expect(saved[0]).not.toHaveProperty('password');
    // The response must not leak key material either.
    expect(result).toEqual({ id: 1, username, realm });
  });

  it('defaults the role rather than taking it from the caller', async () => {
    // `role` used to be part of CreateUserDto, so anyone could register as ADMIN.
    await service.create(
      dto({ role: Roles.ADMIN } as Partial<CreateUserDto>),
      realm,
    );
    expect(saved[0].role).toBe(Roles.USER);
  });

  it('consumes the key exchange, so the secret is single-use', async () => {
    await service.create(dto(), realm);
    expect(cache.has(`dh@${username}`)).toBe(false);
  });

  it('rejects an unknown realm', async () => {
    await expect(service.create(dto(), 'nowhere')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejects registration with no prior key exchange', async () => {
    cache.delete(`dh@${username}`);
    await expect(service.create(dto(), realm)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('rejects a password the client encrypted under the wrong secret', async () => {
    const password_ = crypto.encrypt(password, crypto.genKey());
    await expect(
      service.create(dto({ password: password_ }), realm),
    ).rejects.toThrow(/Decryption failed/);
  });

  it('rejects a short password', async () => {
    await expect(
      service.create(dto({ password: crypto.encrypt('short', shared) }), realm),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects a duplicate principal without touching the keytab', async () => {
    existing = { id: 7, username, realm } as User;
    await expect(service.create(dto(), realm)).rejects.toThrow(
      ConflictException,
    );
    // create() used to overwrite the existing principal's key in Redis before
    // Postgres rejected the insert.
    expect(cache.has(`${username}@${realm}`)).toBe(false);
  });

  describe('keyExchange', () => {
    it('caches a 32-byte secret against the username', async () => {
      const dh = new DhService();
      const client = dh.getPublicKey('modp15');
      const serverPublicKey = await service.keyExchange({
        username: 'someone',
        publicKey: client.publicKey,
        group: 'modp15',
      });
      expect(cache.get('dh@someone')).toEqual(
        dh.deriveKey(client.group, serverPublicKey),
      );
    });
  });
});
