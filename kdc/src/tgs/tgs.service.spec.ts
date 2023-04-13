import { Test, TestingModule } from '@nestjs/testing';
import { TgsService } from './tgs.service';

describe('TgsService', () => {
  let service: TgsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TgsService],
    }).compile();

    service = module.get<TgsService>(TgsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
