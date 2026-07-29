import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { AuthenticatorDto, TicketDto } from 'src/common/types/response';

/**
 * The decrypted service-ticket request. The interceptor replaces the encrypted
 * body with this shape before the pipes run, so validation applies to the
 * plaintext the client actually chose.
 */
export class Request3Dto {
  @ValidateNested()
  @Type(() => TicketDto)
  serviceTicket: TicketDto;

  @ValidateNested()
  @Type(() => AuthenticatorDto)
  authenticator: AuthenticatorDto;
}
