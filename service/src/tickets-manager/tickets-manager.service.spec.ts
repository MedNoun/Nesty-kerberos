import { Test, TestingModule } from '@nestjs/testing';
import { TicketsManagerService } from './tickets-manager.service';

describe('TicketsManagerService', () => {
  let service: TicketsManagerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TicketsManagerService],
    }).compile();

    service = module.get<TicketsManagerService>(TicketsManagerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
