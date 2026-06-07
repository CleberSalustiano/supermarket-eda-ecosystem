import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { HealthController } from '#/interfaces/http/health.controller';

describe('checkout-service health endpoint', () => {
  let application: INestApplication;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        AppLoggerService,
        {
          provide: SERVICE_ENVIRONMENT,
          useValue: {
            nodeEnvironment: 'test',
            serviceName: 'checkout-service',
            appVersion: '0.1.0',
            servicePort: 3001,
            database: {
              host: 'localhost',
              port: 5433,
              name: 'checkout_service',
              user: 'checkout_user',
              password: 'checkout_password',
              ssl: false
            },
            kafka: {
              brokers: ['localhost:19092'],
              clientId: 'checkout-service',
              consumerGroupId: 'checkout-service'
            }
          }
        }
      ]
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
