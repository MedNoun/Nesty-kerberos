import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv } from 'crypto';
import { Req3Dto } from './dto/req3.dto';
import { Request_1 } from './entities/request_1.entity';
import { St } from './entities/st.entity';

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
  req3(incomingRequest: Req3Dto) {
    const { request_1, serviceTicket } = incomingRequest;
    const st: St = JSON.parse(
      this.decrypt(process.env.service_key, serviceTicket),
    );
    const current_time = new Date().getTime();
    const dec: Request_1 = JSON.parse(this.decrypt(st.key, request_1));
    console.log('st: ', st);
    console.log('dec: ', dec);

    if (st.lifetime < current_time) {
      throw new HttpException(
        'ticket expired ! you need to authenticate again !',
        HttpStatus.CONFLICT,
      );
    }
    if (current_time - dec.timestamp > 120000) {
      throw new HttpException(
        'Client decryption too late',
        HttpStatus.CONFLICT,
      );
    }
    const final_pack = {
      app_name: 'hola',
      timestamp: current_time,
    };
    return { package: this.encrypt(st.key, JSON.stringify(final_pack)) };
  }
}
