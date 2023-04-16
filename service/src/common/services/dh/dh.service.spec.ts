import { Test, TestingModule } from '@nestjs/testing';
import { DhService } from './dh.service';

describe('DhService', () => {
  let service: DhService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DhService],
    }).compile();

    service = module.get<DhService>(DhService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
