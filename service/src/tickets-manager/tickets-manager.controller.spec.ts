import { Test, TestingModule } from '@nestjs/testing';
import { TicketsManagerController } from './tickets-manager.controller';
import { TicketsManagerService } from './tickets-manager.service';

describe('TicketsManagerController', () => {
  let controller: TicketsManagerController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TicketsManagerController],
      providers: [TicketsManagerService],
    }).compile();

    controller = module.get<TicketsManagerController>(TicketsManagerController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
