import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';
import request from 'supertest';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { HealthController } from '#/interfaces/http/health.controller';

describe('management-service health endpoint', () => {
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
            serviceName: 'management-service',
            appVersion: '0.1.0',
            servicePort: 3003,
            database: {
              host: 'localhost',
              port: 5435,
              name: 'management_service',
              user: 'management_user',
              password: 'management_password',
              ssl: false
            },
            kafka: {
              brokers: ['localhost:19092'],
              clientId: 'management-service',
              consumerGroupId: 'management-service'
            }
          }
        }
      ]
    }).compile();

    application = moduleFixture.createNestApplication();

    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true
      })
    );
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
      service: 'management-service',
      version: '0.1.0'
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });
});
