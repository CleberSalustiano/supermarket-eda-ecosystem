import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { RegisterProductUseCase } from '#/application/use-cases/register-product.use-case';
import { UpdateProductPriceUseCase } from '#/application/use-cases/update-product-price.use-case';
import { RegisterEmployeeUseCase } from '#/application/use-cases/register-employee.use-case';
import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';
import { CREDENTIAL_HASHER } from '#/application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from '#/application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { OUTBOX_REPLAY_OPTIONS } from '#/application/ports/outbox-replay.options';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { ProductTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product.typeorm-entity';
import { EmployeeTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from '#/infrastructure/security/scrypt-credential-hasher.service';
import { EmployeesController } from '#/interfaces/http/employees.controller';
import { ProductsController } from '#/interfaces/http/products.controller';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';

class ToggleManagementEventPublisher {
  failuresRemaining = 0;
  readonly publishedEvents: unknown[] = [];

  async publish(event: unknown): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('Simulated management publisher failure');
    }

    this.publishedEvents.push(event);
  }
}

describe('management-service outbox replay flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let replayPendingOutboxEventsUseCase: ReplayPendingOutboxEventsUseCase;
  let publisher: ToggleManagementEventPublisher;

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();
    publisher = new ToggleManagementEventPublisher();

    const moduleFixture = await Test.createTestingModule({
      controllers: [ProductsController, EmployeesController],
      providers: [
        AppLoggerService,
        RegisterEmployeeUseCase,
        RegisterProductUseCase,
        ReplayPendingOutboxEventsUseCase,
        UpdateProductPriceUseCase,
        ReliableOutboxEventRelayService,
        ScryptCredentialHasherService,
        TypeormManagementTransactionRunner,
        TypeormOutboxEventRepository,
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
        },
        {
          provide: DataSource,
          useValue: dataSource
        },
        {
          provide: CREDENTIAL_HASHER,
          useExisting: ScryptCredentialHasherService
        },
        {
          provide: MANAGEMENT_EVENT_PUBLISHER,
          useValue: publisher
        },
        {
          provide: MANAGEMENT_TRANSACTION_RUNNER,
          useExisting: TypeormManagementTransactionRunner
        },
        {
          provide: OUTBOX_EVENT_RELAY,
          useExisting: ReliableOutboxEventRelayService
        },
        {
          provide: OUTBOX_EVENT_REPOSITORY,
          useExisting: TypeormOutboxEventRepository
        },
        {
          provide: OUTBOX_REPLAY_OPTIONS,
          useValue: {
            intervalMs: 30000,
            batchSize: 10
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
    replayPendingOutboxEventsUseCase = application.get(ReplayPendingOutboxEventsUseCase);
  });

  afterEach(async () => {
    publisher.failuresRemaining = 0;
    publisher.publishedEvents.length = 0;

    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.getRepository(OutboxEventTypeormEntity).clear();
    await dataSource.getRepository(ProductTypeormEntity).clear();
    await dataSource.getRepository(EmployeeTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('replays a pending management outbox event after the publisher recovers', async () => {
    publisher.failuresRemaining = 1;

    const response = await request(application.getHttpAdapter().getInstance())
      .post('/products')
      .send({
        tenantId: '4d73874c-36a5-421a-8853-a55747947b6e',
        name: 'Orange Juice',
        barcode: '7891000000200',
        unitOfMeasure: 'unit',
        price: 9.9
      })
      .expect(201);

    expect(response.body.eventPublicationStatus).toBe('pending');
    expect(publisher.publishedEvents).toHaveLength(0);

    const replayResult = await replayPendingOutboxEventsUseCase.execute();
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();

    expect(replayResult).toMatchObject({
      scannedEvents: 1,
      publishedEvents: 1,
      stillPendingEvents: 0
    });
    expect(publisher.publishedEvents).toHaveLength(1);
    expect(persistedOutboxEvents[0]?.publishedAt).toEqual(expect.any(Date));
  });
});
