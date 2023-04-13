import { Test, TestingModule } from '@nestjs/testing';
import { AsController } from './as.controller';
import { AsService } from './as.service';

describe('AsController', () => {
  let controller: AsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AsController],
      providers: [AsService],
    }).compile();

    controller = module.get<AsController>(AsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
