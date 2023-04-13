import { Test, TestingModule } from '@nestjs/testing';
import { TgsController } from './tgs.controller';
import { TgsService } from './tgs.service';

describe('TgsController', () => {
  let controller: TgsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TgsController],
      providers: [TgsService],
    }).compile();

    controller = module.get<TgsController>(TgsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
