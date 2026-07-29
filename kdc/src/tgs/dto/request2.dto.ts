import { Type } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { AuthenticatorDto, TicketDto } from 'src/common/types/response';

export class TicketRequestDto {
  /** Principal of the service the client wants a ticket for. */
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  requestedLifetime: number;
}

/**
 * The decrypted TGS request. The interceptor replaces the encrypted body with
 * this shape before the pipes run, so validation applies to the plaintext the
 * client actually chose.
 */
export class Request2Dto {
  @ValidateNested()
  @Type(() => TicketDto)
  tgt: TicketDto;

  @ValidateNested()
  @Type(() => AuthenticatorDto)
  authenticator: AuthenticatorDto;

  @ValidateNested()
  @Type(() => TicketRequestDto)
  request: TicketRequestDto;
}
