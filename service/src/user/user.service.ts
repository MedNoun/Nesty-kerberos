import { CACHE_MANAGER } from '@nestjs/cache-manager';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Cache } from 'cache-manager';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { DH_TTL_SECONDS, NO_EXPIRY } from 'src/common/kerberos.constants';
import { DhService } from 'src/common/services/dh/dh.service';
import { RealmsConfig } from 'src/common/types/realm';
import { Roles } from 'src/common/types/roles.enum';
import { Repository } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { keyExchangeDto } from './dto/keyExchange.dto';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dhService: DhService,
    private readonly cryptoService: CryptoService,
    private readonly configService: ConfigService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}

  /**
   * Ephemeral Diffie-Hellman so the password never crosses the wire in the
   * clear. The secret is cached against the username for two minutes and is
   * single-use: create() deletes it.
   */
  public async keyExchange(keyExchange: keyExchangeDto): Promise<string> {
    const { group, publicKey } = this.dhService.getPublicKey(keyExchange.group);
    const shared = this.dhService.deriveKey(group, keyExchange.publicKey);
    await this.cacheService.set(
      `dh@${keyExchange.username}`,
      shared,
      DH_TTL_SECONDS,
    );
    return publicKey;
  }

  public async create(createUserDto: CreateUserDto, realm: string) {
    const realms = this.configService.get<RealmsConfig>('realms');
    if (!realms?.[realm]) {
      throw new BadRequestException(`Unknown realm ${realm}`);
    }
    const shared = await this.cacheService.get<string>(
      `dh@${createUserDto.username}`,
    );
    if (!shared) {
      throw new ForbiddenException('No key exchange: hit /user/dh first');
    }
    const password = this.cryptoService.decrypt<string>(
      createUserDto.password,
      shared,
    );
    if (typeof password !== 'string' || password.length < 8) {
      throw new BadRequestException(
        'The password must be at least 8 characters',
      );
    }
    const existing = await this.userRepository.findOne({
      where: { username: createUserDto.username, realm },
    });
    if (existing) {
      // Checked before the keytab is written: create() used to overwrite an
      // existing principal's key in Redis before Postgres rejected the insert.
      throw new ConflictException('That username is already registered');
    }
    // string2key: the keytab holds the derived long-term key, and the password
    // is not stored anywhere.
    const principalKey = this.cryptoService.string2key(
      password,
      realm,
      createUserDto.username,
    );
    const user = this.userRepository.create({
      username: createUserDto.username,
      realm,
      firstname: createUserDto.firstname,
      lastname: createUserDto.lastname,
      role: Roles.USER,
      principalKey,
    });
    const saved = await this.userRepository.save(user);
    await this.cacheService.set(
      `${createUserDto.username}@${realm}`,
      principalKey,
      NO_EXPIRY,
    );
    await this.cacheService.del(`dh@${createUserDto.username}`);
    // Deliberately narrow: the entity carries key material.
    return { id: saved.id, username: saved.username, realm: saved.realm };
  }
}
