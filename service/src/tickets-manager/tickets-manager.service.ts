import { HttpException, Inject, Injectable } from '@nestjs/common';
import { Request3Dto } from './dto/request3.dto';
import { Challenge, Payload } from 'src/common/types/response';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';

@Injectable()
export class TicketsManagerService {
  constructor(@Inject(CACHE_MANAGER) private cacheService: Cache) {}
  async generateTicket(request: Request3Dto, ip: string, realm: string) {
    if (request.serviceTicket.ip !== ip) {
      throw new HttpException('Different Source detected', 404);
    }
    if (request.serviceTicket.username !== request.authenticator.username) {
      throw new HttpException('Different Username', 404);
    }
    if (request.serviceTicket.lifetime < new Date().getTime()) {
      throw new HttpException('Ticket Expired ! ', 404);
    }
    if (
      request.authenticator.timestamp - request.serviceTicket.timestamp >
      120000
    ) {
      throw new HttpException(
        'Replay possibility please reauthenticate ! ',
        404,
      );
    }
    const auth = await this.cacheService.get(
      request.serviceTicket.principal +
        '_' +
        request.authenticator.username +
        '@' +
        realm,
    );
    if (auth) {
      throw new HttpException(
        'You already got a ticket use it or reauthenticate after it expires!',
        404,
      );
    }
    // lets cache the tgt then :
    this.cacheService.set(
      request.serviceTicket.principal +
        '_' +
        request.authenticator.username +
        '@' +
        realm,
      request.authenticator,
      request.serviceTicket.lifetime - new Date().getTime(),
    );
    // we need to verify whether the authenticator is in the cash or not and put it until lifetime ends. Throw error if found in cache
    // TODO
    const challenge: Challenge = new Challenge(
      request.serviceTicket.principal,
      new Date().getTime(),
      request.serviceTicket.lifetime,
      request.serviceTicket.sessionKey,
    );
    return new Payload(
      challenge,
      request.authenticator.username,
      realm,
      request.serviceTicket.principal,
      ip,
      new Date().getTime(),
    );
  }
}
