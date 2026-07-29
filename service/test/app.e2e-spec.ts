import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Cache } from 'cache-manager';
import * as request from 'supertest';
import { AppModule } from './../src/app.module';

describe('AppController (e2e)', () => {
  let app: INestApplication;
  let cache: Cache;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    cache = app.get<Cache>(CACHE_MANAGER);
  });

  afterAll(async () => {
    // The Redis store does not disconnect on teardown, so jest would sit on an
    // open handle. Booting once per suite rather than once per test also stops
    // each test opening another connection.
    await (
      cache?.store as unknown as {
        getClient?: () => { quit: () => Promise<unknown> };
      }
    )
      ?.getClient?.()
      ?.quit();
    await app?.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
