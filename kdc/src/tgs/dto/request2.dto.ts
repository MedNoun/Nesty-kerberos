import { Authenticator, Encryption, Ticket } from 'src/common/types/response';

export class Request2Dto {
  tgt: Ticket;
  authenticator: Authenticator;
  request: {
    id: string;
    requestedLifetime: number;
  };
}
