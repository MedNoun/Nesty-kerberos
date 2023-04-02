import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Req2Dto } from './dto/req2.dto';
import { Request_1 } from './entities/request_1.entity';
import { Tgt } from './entities/tgt.entity';

@Injectable()
export class AppService {
  private algorithm = 'aes-256-ctr';
  private iv: Buffer = Buffer.from(process.env.iv, 'hex');
  private keySize = 32;

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
  req2(incomingRequest: Req2Dto) {
    const key: string = process.env.tgs_key;
    const { request_1, request_2, tgt } = incomingRequest;
    const decryption = this.decrypt(key, tgt);
    const ticket: Tgt = JSON.parse(decryption);

    const req1: Request_1 = JSON.parse(this.decrypt(ticket.key, request_1));

    // save the new session key in the database : user: session_key
    const current_time = new Date().getTime();
    if (ticket.lifetime < current_time) {
      throw new HttpException(
        'ticket expired ! you need to authenticate again !',
        HttpStatus.CONFLICT,
      );
    }
    if (current_time - req1.timestamp > 120000) {
      throw new HttpException(
        'Client decryption too late',
        HttpStatus.CONFLICT,
      );
    }
    // add ip address to whitlist maybe
    // TODO
    const serviceSessionKey = randomBytes(this.keySize).toString('hex');
    const serviceKey = process.env.service_key;

    const package1 = {
      key: serviceSessionKey,
      timestamp: current_time,
      username: req1.username,
      ip: '127.0.0.1',
      lifetime: current_time + 120000,
    };
    const package2 = {
      key: serviceSessionKey,
      serviceName: request_2,
      timestamp: current_time,
      lifetime: current_time + 120000,
    };

    return {
      serviceTicket: this.encrypt(serviceKey, JSON.stringify(package1)),
      clientTicket: this.encrypt(key, JSON.stringify(package2)),
      req1: this.encrypt(
        serviceSessionKey,
        JSON.stringify({ username: 'tirma', timestamp: current_time }),
      ),
    };
  }
}
