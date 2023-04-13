import { HttpCode, HttpException, Injectable } from '@nestjs/common';
import { Request2Dto } from './dto/request2.dto';
import { Challenge, Payload, Ticket } from 'src/common/types/response';

@Injectable()
export class TgsService {
  constructor() {}
  generateTicket(request: Request2Dto, ip: string, realm: string): Payload {
    if (request.tgt.ip !== ip) {
      throw new HttpException('Different Source detected', 404);
    }
    if (request.tgt.username !== request.authenticator.username) {
      throw new HttpException('Different Username', 404);
    }
    if (request.tgt.lifetime < new Date().getTime()) {
      throw new HttpException('Ticket Expired ! ', 404);
    }
    if (request.authenticator.timestamp - request.tgt.timestamp > 120000) {
      throw new HttpException(
        'Replay possibility please reauthenticate ! ',
        404,
      );
    }
    // we need to verify whether the authenticator is in the cash or not and put it until lifetime ends. Throw error if found in cache
    // TODO
    const challenge: Challenge = new Challenge(
      request.request.id,
      new Date().getTime(),
      request.tgt.lifetime,
      '',
    );
    return new Payload(
      challenge,
      request.authenticator.username,
      realm,
      request.request.id,
      ip,
      request.request.requestedLifetime,
    );
  }
}
