import { Test, TestingModule } from '@nestjs/testing';
import { AsService } from './as.service';

describe('AsService', () => {
  let service: AsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AsService],
    }).compile();

    service = module.get<AsService>(AsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
