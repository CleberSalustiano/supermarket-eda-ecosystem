import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import { InventoryLossReason } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { INVENTORY_EVENT_PUBLISHER } from '#/application/ports/inventory-event-publisher.port';
import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { OUTBOX_REPLAY_OPTIONS } from '#/application/ports/outbox-replay.options';
import { RegisterInventoryLossUseCase } from '#/application/use-cases/register-inventory-loss.use-case';
import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';
import { InventoryLossTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-loss.typeorm-entity';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { StockMovementTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/stock-movement.typeorm-entity';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { InventoryLossesController } from '#/interfaces/http/inventory-losses.controller';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';

class ToggleInventoryEventPublisher {
  failuresRemaining = 0;
  readonly publishedEvents: unknown[] = [];

  async publish(event: unknown): Promise<void> {
    if (this.failuresRemaining > 0) {
      this.failuresRemaining -= 1;
      throw new Error('Simulated inventory publisher failure');
    }

    this.publishedEvents.push(event);
  }
}

describe('inventory-service outbox replay flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let replayPendingOutboxEventsUseCase: ReplayPendingOutboxEventsUseCase;
  let publisher: ToggleInventoryEventPublisher;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();
    publisher = new ToggleInventoryEventPublisher();

    const moduleFixture = await Test.createTestingModule({
      controllers: [InventoryLossesController],
      providers: [
        AppLoggerService,
        RegisterInventoryLossUseCase,
        ReplayPendingOutboxEventsUseCase,
        ReliableOutboxEventRelayService,
        TypeormInventoryTransactionRunner,
        TypeormOutboxEventRepository,
        {
          provide: SERVICE_ENVIRONMENT,
          useValue: {
            nodeEnvironment: 'test',
            serviceName: 'inventory-service',
            appVersion: '0.1.0',
            servicePort: 3002,
            database: {
              host: 'localhost',
              port: 5434,
              name: 'inventory_service',
              user: 'inventory_user',
              password: 'inventory_password',
              ssl: false
            },
            kafka: {
              brokers: ['localhost:19092'],
              clientId: 'inventory-service',
              consumerGroupId: 'inventory-service'
            }
          }
        },
        {
          provide: DataSource,
          useValue: dataSource
        },
        {
          provide: INVENTORY_EVENT_PUBLISHER,
          useValue: publisher
        },
        {
          provide: INVENTORY_TRANSACTION_RUNNER,
          useExisting: TypeormInventoryTransactionRunner
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
    await dataSource.getRepository(InventoryLossTypeormEntity).clear();
    await dataSource.getRepository(StockMovementTypeormEntity).clear();
    await dataSource.getRepository(InventoryItemTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('replays a pending inventory outbox event after the publisher recovers', async () => {
    publisher.failuresRemaining = 1;

    const response = await request(application.getHttpAdapter().getInstance())
      .post('/inventory-losses')
      .send({
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        quantity: 2,
        reasonCode: InventoryLossReason.Damaged,
        notes: 'Bottle leaked',
        occurredAt: '2026-06-11T10:00:00.000Z'
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
