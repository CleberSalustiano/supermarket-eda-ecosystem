import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { LOW_STOCK_ALERT_EVENT_NAME } from '@supermarket/shared-domain';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { INVENTORY_EVENT_PUBLISHER } from '#/application/ports/inventory-event-publisher.port';
import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
import { LOW_STOCK_ALERT_OPTIONS } from '#/application/ports/low-stock-alert.options';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { EmitLowStockAlertsUseCase } from '#/application/use-cases/emit-low-stock-alerts.use-case';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';
import { FakeInventoryEventPublisher } from '../support/in-memory-inventory-test-doubles';

describe('inventory-service low stock alert flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let emitLowStockAlertsUseCase: EmitLowStockAlertsUseCase;
  let inventoryEventPublisher: FakeInventoryEventPublisher;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();
    inventoryEventPublisher = new FakeInventoryEventPublisher();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        EmitLowStockAlertsUseCase,
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
          provide: LOW_STOCK_ALERT_OPTIONS,
          useValue: {
            intervalMs: 300000,
            cooldownMinutes: 60,
            maxItemsPerBatch: 2
          }
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
    await application.init();
    emitLowStockAlertsUseCase = application.get(EmitLowStockAlertsUseCase);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    inventoryEventPublisher.publishedEvents.length = 0;

    await dataSource.getRepository(OutboxEventTypeormEntity).clear();
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

  it('emits batched low stock alerts by tenant and preserves cooldown suppression', async () => {
    await dataSource.getRepository(InventoryItemTypeormEntity).save([
      {
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 1,
        minimumThreshold: 2,
        averageUnitCost: 7.7,
        lastLowStockAlertAt: null,
        createdAt: new Date('2026-06-13T08:00:00.000Z'),
        updatedAt: new Date('2026-06-13T08:00:00.000Z')
      },
      {
        productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000201',
        name: 'Whole Milk',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 0,
        minimumThreshold: 1,
        averageUnitCost: 6.2,
        lastLowStockAlertAt: null,
        createdAt: new Date('2026-06-13T08:00:00.000Z'),
        updatedAt: new Date('2026-06-13T08:00:00.000Z')
      },
      {
        productId: '34d1df0b-041f-485c-b34d-4156d89021a5',
        tenantId: '87b9f60a-f5b9-4215-80da-2f7ccd5bb322',
        barcode: '7891000000202',
        name: 'Rice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 4,
        minimumThreshold: 5,
        averageUnitCost: 4.1,
        lastLowStockAlertAt: null,
        createdAt: new Date('2026-06-13T08:00:00.000Z'),
        updatedAt: new Date('2026-06-13T08:00:00.000Z')
      },
      {
        productId: '47e93877-33f4-44b0-b633-9347ce2b5f93',
        tenantId: '87b9f60a-f5b9-4215-80da-2f7ccd5bb322',
        barcode: '7891000000203',
        name: 'Beans',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 1,
        minimumThreshold: 3,
        averageUnitCost: 5.4,
        lastLowStockAlertAt: new Date('2026-06-13T11:30:00.000Z'),
        createdAt: new Date('2026-06-13T08:00:00.000Z'),
        updatedAt: new Date('2026-06-13T11:30:00.000Z')
      }
    ]);

    const result = await emitLowStockAlertsUseCase.execute({
      emittedAt: new Date('2026-06-13T12:00:00.000Z')
    });

    expect(result.scannedCandidates).toBe(3);
    expect(result.emittedBatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
          itemsCount: 2,
          eventPublicationStatus: 'published'
        }),
        expect.objectContaining({
          tenantId: '87b9f60a-f5b9-4215-80da-2f7ccd5bb322',
          itemsCount: 1,
          eventPublicationStatus: 'published'
        })
      ])
    );
    expect(inventoryEventPublisher.publishedEvents).toHaveLength(2);
    expect(
      inventoryEventPublisher.publishedEvents.every(
        (event) => event.eventName === LOW_STOCK_ALERT_EVENT_NAME
      )
    ).toBe(true);

    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();
    const persistedItems = await dataSource.getRepository(InventoryItemTypeormEntity).find();
    const persistedItemsByProductId = new Map(
      persistedItems.map((item) => [item.productId, item.lastLowStockAlertAt?.toISOString() ?? null])
    );

    expect(persistedOutboxEvents).toHaveLength(2);
    expect(
      persistedOutboxEvents.every((event) => event.publishedAt instanceof Date)
    ).toBe(true);
    expect(persistedItemsByProductId.get('9580902a-ded1-4e9f-9b45-ab7cb8d8340d')).toBe(
      '2026-06-13T12:00:00.000Z'
    );
    expect(persistedItemsByProductId.get('8021d70d-bbbd-46c9-8d2b-9ebfe13c5424')).toBe(
      '2026-06-13T12:00:00.000Z'
    );
    expect(persistedItemsByProductId.get('34d1df0b-041f-485c-b34d-4156d89021a5')).toBe(
      '2026-06-13T12:00:00.000Z'
    );
    expect(persistedItemsByProductId.get('47e93877-33f4-44b0-b633-9347ce2b5f93')).toBe(
      '2026-06-13T11:30:00.000Z'
    );
  });
});
