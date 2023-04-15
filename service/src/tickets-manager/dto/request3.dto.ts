import { Authenticator, Ticket } from 'src/common/types/response';

export class Request3Dto {
  serviceTicket: Ticket;
  authenticator: Authenticator;
}
