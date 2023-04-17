import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { DhService } from 'src/common/services/dh/dh.service';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { Repository } from 'typeorm';
import { CryptoService } from 'src/common/crypto/crypto.service';
import { BinaryToTextEncoding, getDiffieHellman } from 'crypto';
import { keyExchangeDto } from './dto/keyExchange.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly dhService: DhService,
    private readonly cryptoService: CryptoService,
    @Inject(CACHE_MANAGER) private cacheService: Cache,
  ) {}
  async test() {
    const { group, key } = this.dhService.getPublicKey('modp15', 'hex');
    // api call in the front
    const newkey = await this.keyExchange({
      username: 'mednoun',
      group: 'modp15',
      publicKey: key,
      encoding: 'hex',
    });
    // this should be the same as the one in the cache
    console.log(this.dhService.generateKey(group, newkey, 'hex'));
    return key;
  }
  async keyExchange(keyExchange: keyExchangeDto) {
    const { group, key } = this.dhService.getPublicKey(
      keyExchange.group,
      keyExchange.encoding,
    );
    const shared = this.dhService.generateKey(
      group,
      keyExchange.publicKey,
      keyExchange.encoding,
    );
    await this.cacheService.set('dh@' + keyExchange.username, shared, 120000);
    return key;
  }
  async create(createUserDto: CreateUserDto, realm: string) {
    const key = await this.cacheService.get<string>(
      'dh@' + createUserDto.username,
    );
    if (!key) {
      throw new HttpException('no key exchange hit /user/dh', 403);
    }
    const password = this.cryptoService.decrypt(createUserDto.password, key);
    await this.cacheService.set(
      createUserDto.username + '@' + realm,
      password,
      -1,
    );
    const user = this.userRepository.create({
      username: createUserDto.username,
      firstname: createUserDto.firstname,
      lastname: createUserDto.lastname,
      role: createUserDto.role,
      password: password,
    });
    return await this.userRepository.save(user);
  }

  findAll() {
    return `This action returns all user`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
