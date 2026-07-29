import { Roles } from 'src/common/types/roles.enum';
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/**
 * A principal record. It holds the long-term key derived from the password by
 * string2key, never the password, and never a session key: session keys are
 * per-exchange and live in Redis.
 *
 * A production KDC would encrypt this column under a master key. Here it is
 * stored as-is, which is the one honest gap left in the credential store.
 */
@Entity()
@Index(['username', 'realm'], { unique: true })
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  username: string;

  @Column()
  realm: string;

  @Column()
  firstname: string;

  @Column()
  lastname: string;

  /** 32 bytes of hex from PBKDF2-HMAC-SHA256 over the password. */
  @Column({ length: 64 })
  principalKey: string;

  @Column({ enum: Roles })
  role: Roles;
}
