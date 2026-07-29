import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ReplayCacheService } from 'src/common/cache/replay-cache.service';
import { SKEW_MS } from 'src/common/kerberos.constants';
import { Authenticator, Challenge, Payload } from 'src/common/types/response';
import { Request3Dto } from './dto/request3.dto';

@Injectable()
export class TicketsManagerService {
  constructor(private readonly replayCache: ReplayCacheService) {}

  public async generateTicket(
    request: Request3Dto,
    ip: string,
    realm: string,
  ): Promise<Payload> {
    const { serviceTicket, authenticator } = request;
    if (serviceTicket.ip !== ip) {
      throw new UnauthorizedException('Different source detected');
    }
    if (serviceTicket.username !== authenticator.username) {
      throw new UnauthorizedException('Different username');
    }
    if (serviceTicket.lifetime < Date.now()) {
      throw new UnauthorizedException('Ticket expired');
    }
    // Skew is measured against this server's clock, not the ticket's issue time.
    if (Math.abs(Date.now() - authenticator.timestamp) > SKEW_MS) {
      throw new UnauthorizedException(
        'Authenticator outside the allowed clock skew',
      );
    }
    // Keyed on the authenticator itself, held only for as long as one could
    // still be accepted, and set atomically so two concurrent replays cannot
    // both pass the check.
    const replayed = await this.replayCache.isReplay(
      `replay:${realm}:${serviceTicket.principal}:${authenticator.username}:${authenticator.timestamp}`,
      SKEW_MS,
    );
    if (replayed) {
      throw new UnauthorizedException('Authenticator already used');
    }
    const challenge = new Challenge(
      serviceTicket.principal,
      Date.now(),
      serviceTicket.lifetime,
      serviceTicket.sessionKey,
    );
    // RFC 4120 AP_REP echoes the client's own timestamp back, which is what
    // proves the server read the authenticator rather than just holding a key.
    return {
      challenge,
      authenticator: new Authenticator(
        authenticator.username,
        authenticator.timestamp,
      ),
    };
  }
}
