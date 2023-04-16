import { Encryption } from 'src/common/types/response';
import { Roles } from 'src/common/types/roles.enum';

export class CreateUserDto {
  username: string;
  firstname: string;
  lastname: string;
  role: Roles;
  password: Encryption;
}
