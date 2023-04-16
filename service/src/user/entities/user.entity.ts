import { Roles } from 'src/common/types/roles.enum';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;
  @Column({ unique: true })
  username: string;
  @Column()
  firstname: string;
  @Column()
  lastname: string;
  @Column({ length: 256 })
  password: string;
  @Column({ enum: Roles })
  role: Roles;
  @Column({ length: 256 })
  sessionKey: string;
  @Column({ length: 256 })
  dhKey: string;
}
