import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter
} from '@supermarket/shared-infra';

import { InventoryServiceModule } from '../src/inventory-service.module';

describe('inventory-service health endpoint', () => {
  let application: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [InventoryServiceModule]
    }).compile();

    application = moduleFixture.createNestApplication();

    application.useGlobalInterceptors(new CorrelationIdInterceptor());
    application.useGlobalFilters(new GlobalHttpExceptionFilter(application.get(AppLoggerService)));

    await application.init();
  });

  afterAll(async () => {
    await application.close();
  });

  it('returns the service metadata and a correlation id', async () => {
    const response = await request(application.getHttpAdapter().getInstance())
      .get('/health')
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'inventory-service',
      version: '0.1.0'
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });
});
