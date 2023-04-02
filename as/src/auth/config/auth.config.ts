import { registerAs } from '@nestjs/config';
import { randomBytes } from 'crypto';
export default registerAs('secrets', () => ({
  'insat.tn': randomBytes(256),
  'gl4.tn': randomBytes(256),
  KDC: randomBytes(256),
}));
