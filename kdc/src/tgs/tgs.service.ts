import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ReplayCacheService } from 'src/common/cache/replay-cache.service';
import { SKEW_MS, TGS_PRINCIPAL } from 'src/common/kerberos.constants';
import { Challenge, Payload } from 'src/common/types/response';
import { Request2Dto } from './dto/request2.dto';

@Injectable()
export class TgsService {
  constructor(private readonly replayCache: ReplayCacheService) {}

  public async generateTicket(
    request: Request2Dto,
    ip: string,
    realm: string,
  ): Promise<Payload> {
    const { tgt, authenticator } = request;
    if (tgt.principal !== TGS_PRINCIPAL) {
      throw new UnauthorizedException('Ticket was not issued for the TGS');
    }
    if (tgt.ip !== ip) {
      throw new UnauthorizedException('Different source detected');
    }
    if (tgt.username !== authenticator.username) {
      throw new UnauthorizedException('Different username');
    }
    if (tgt.lifetime < Date.now()) {
      throw new UnauthorizedException('Ticket expired');
    }
    // Skew is measured against this server's clock. Comparing the authenticator
    // to the ticket's own issue time, which is what this did, let a captured
    // authenticator stay valid for the ticket's entire lifetime.
    if (Math.abs(Date.now() - authenticator.timestamp) > SKEW_MS) {
      throw new UnauthorizedException(
        'Authenticator outside the allowed clock skew',
      );
    }
    // Keyed on the authenticator itself and held only for as long as one could
    // still be accepted. Keying it on the username with the ticket's remaining
    // lifetime as the TTL locked a user out for hours and caught no replays.
    const replayed = await this.replayCache.isReplay(
      `replay:${realm}:${TGS_PRINCIPAL}:${authenticator.username}:${authenticator.timestamp}`,
      SKEW_MS,
    );
    if (replayed) {
      throw new UnauthorizedException('Authenticator already used');
    }
    const challenge = new Challenge(request.request.id, Date.now(), 0, '');
    return {
      challenge,
      username: authenticator.username,
      realm,
      principal: request.request.id,
      ip,
      requestedLifetime: request.request.requestedLifetime,
      clientKey: tgt.sessionKey,
      maxExpiry: tgt.lifetime,
    };
  }
}
