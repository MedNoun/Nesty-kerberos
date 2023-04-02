import { Injectable } from '@nestjs/common';
import { FirstReqDto } from './dto/firstReq.dto';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'crypto';
import { ConfigService, ConfigType } from '@nestjs/config';
import { UserService } from 'src/user/user.service';
import { User } from 'src/user/entities/user.entity';

@Injectable()
export class AuthService {
  private algorithm = 'aes-256-ctr';
  private iv: Buffer = Buffer.from(process.env.iv, 'hex');
  private keySize = 32;
  constructor(
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  private decrypt(password: string, ciphertext: string) {
    const keyBuffer = Buffer.from(password, 'hex');
    var decipher = createDecipheriv(this.algorithm, keyBuffer, this.iv);
    let plaintext = decipher.update(ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
  private encrypt(password: string, text: string) {
    const keyBuffer = Buffer.from(password, 'hex');
    var cipher = createCipheriv(this.algorithm, keyBuffer, this.iv);
    var crypted = cipher.update(text, 'utf8', 'base64');
    crypted += cipher.final('base64');
    return crypted;
  }
  async test() {
    return await this.req1({
      username: 'tirma',
      tgs: 'insat',
      challenge: this.encrypt(
        createHash('sha256').update(String('tirma123')).digest('hex'),
        'hola',
      ),
    });
  }
  async req1(req1: FirstReqDto) {
    // const user: User = await this.userService.findOne(req1.username);
    const user: User = {
      id: 1,
      name: 'slim',
      lastName: '9ird',
      username: 'tirma',
      password: createHash('sha256').update(String('tirma123')).digest('hex'),
    };
    console.log('this is our user: ', user);

    if (user) {
      const decryption = this.decrypt(user.password, req1.challenge);
      const tgsSessionKey = randomBytes(this.keySize).toString('hex');
      const timestamp = new Date().getTime();

      const package1 = {
        key: tgsSessionKey,
        timestamp,
        username: user.username,
        tgsn: req1.tgs,
        lifetime: timestamp + 120000,
      };
      const package2 = {
        key: tgsSessionKey,
        timestamp,
        username: user.username,
        ip: '127.0.0.1',
        lifetime: timestamp + 120000,
      };
      return {
        TGTResponse: this.encrypt(user.password, JSON.stringify(package1)),
        TicketGrantingTicket: this.encrypt(
          process.env[req1.tgs],
          JSON.stringify(package2),
        ),
        req1: this.encrypt(
          tgsSessionKey,
          JSON.stringify({ username: 'tirma', timestamp: timestamp }),
        ),
      };
    } else {
      throw Error('user not found : ' + req1.username);
    }
  }
}
