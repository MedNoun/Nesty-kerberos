import { Type } from 'class-transformer';
import {
  IsDefined,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { EncryptionDto } from 'src/common/types/response';

export class Request1Dto {
  @IsString()
  @IsNotEmpty()
  username: string;

  @IsString()
  @IsNotEmpty()
  serviceName: string;

  @IsInt()
  @Min(0)
  requestedLifetime: number;

  /**
   * Kerberos pre-authentication: `{ username, timestamp }` encrypted under the
   * client's long-term key. Without it the AS issued a ticket to anyone who
   * named an existing principal, proving nothing.
   */
  // IsDefined as well as ValidateNested: class-validator skips a nested
  // validator when the value is absent, so a missing pre-authenticator would
  // reach the service and come back as a 401 rather than a 400.
  @IsDefined()
  @ValidateNested()
  @Type(() => EncryptionDto)
  preAuth: EncryptionDto;
}
