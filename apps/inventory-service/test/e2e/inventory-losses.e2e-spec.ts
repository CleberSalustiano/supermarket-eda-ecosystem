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
import { RegisterInventoryLossUseCase } from '#/application/use-cases/register-inventory-loss.use-case';
import { InventoryLossTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-loss.typeorm-entity';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { StockMovementTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/stock-movement.typeorm-entity';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { InventoryLossesController } from '#/interfaces/http/inventory-losses.controller';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';
import { FakeInventoryEventPublisher } from '../support/in-memory-inventory-test-doubles';

describe('inventory-service inventory losses flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let inventoryEventPublisher: FakeInventoryEventPublisher;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();
    inventoryEventPublisher = new FakeInventoryEventPublisher();

    const moduleFixture = await Test.createTestingModule({
      controllers: [InventoryLossesController],
      providers: [
        AppLoggerService,
        RegisterInventoryLossUseCase,
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
          useValue: inventoryEventPublisher
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

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    inventoryEventPublisher.publishedEvents.length = 0;

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

  it('registers an inventory loss, persists the audit trail, and publishes the integration event', async () => {
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

    expect(response.body).toMatchObject({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      onHandQuantity: -2,
      eventPublicationStatus: 'published'
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));

    const persistedLosses = await dataSource.getRepository(InventoryLossTypeormEntity).find();
    const persistedItems = await dataSource.getRepository(InventoryItemTypeormEntity).find();
    const persistedMovements = await dataSource.getRepository(StockMovementTypeormEntity).find();
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();

    expect(persistedLosses).toHaveLength(1);
    expect(persistedItems[0]?.onHandQuantity).toBe(-2);
    expect(persistedMovements).toHaveLength(1);
    expect(persistedMovements[0]?.movementType).toBe('LOSS');
    expect(persistedOutboxEvents).toHaveLength(1);
    expect(persistedOutboxEvents[0]?.publishedAt).toEqual(expect.any(Date));
    expect(inventoryEventPublisher.publishedEvents).toHaveLength(1);
    expect(inventoryEventPublisher.publishedEvents[0]?.eventName).toBe('InventoryLossRegistered');
  });
});
