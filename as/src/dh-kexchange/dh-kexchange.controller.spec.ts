import { Test, TestingModule } from '@nestjs/testing';
import { DhKexchangeController } from './dh-kexchange.controller';

describe('DhKexchangeController', () => {
  let controller: DhKexchangeController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DhKexchangeController],
    }).compile();

    controller = module.get<DhKexchangeController>(DhKexchangeController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
