import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, Length, ValidateNested } from 'class-validator';
import { EncryptionDto } from 'src/common/types/response';

export class CreateUserDto {
  @IsString()
  @Length(1, 64)
  username: string;

  @IsString()
  @Length(1, 64)
  firstname: string;

  @IsString()
  @Length(1, 64)
  lastname: string;

  /**
   * The password, encrypted under the Diffie-Hellman secret from /user/dh.
   *
   * `role` used to be part of this DTO and was written straight to the entity,
   * so any caller could register themselves as an administrator. It is now set
   * server-side.
   */
  @ValidateNested()
  @Type(() => EncryptionDto)
  @IsNotEmpty()
  password: EncryptionDto;
}
