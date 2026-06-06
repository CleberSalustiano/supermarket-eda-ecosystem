import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter
} from '@supermarket/shared-infra';

import { CheckoutServiceModule } from '../../src/checkout-service.module';

describe('checkout-service health endpoint', () => {
  let application: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [CheckoutServiceModule]
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
      service: 'checkout-service',
      version: '0.1.0'
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });
});
