import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Request2Dto } from './dto/request2.dto';
import { Challenge, Payload, Ticket } from 'src/common/types/response';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class TgsService {
  constructor(@Inject(CACHE_MANAGER) private cacheService: Cache) {}
  async generateTicket(
    request: Request2Dto,
    ip: string,
    realm: string,
  ): Promise<Payload> {
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
    const auth = await this.cacheService.get(
      'tgs_' + request.authenticator.username + '@' + realm,
    );
    if (auth) {
      throw new HttpException(
        'You already got a ticket use it or reauthenticate after it expires!' +
          auth,
        404,
      );
    }
    // lets cache the tgt then :
    await this.cacheService.set(
      'tgs_' + request.authenticator.username + '@' + realm,
      request.authenticator,
      request.tgt.lifetime - new Date().getTime(),
    );

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
