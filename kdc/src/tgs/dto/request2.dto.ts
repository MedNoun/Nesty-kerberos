import { Encryption, Ticket } from 'src/common/types/response';

export class Request2Dto {
  tgt: Ticket;
  authenticator: {
    username: string;
    timestamp: number;
  };
  request: {
    id: string;
    requestedLifetime: number;
  };
}
