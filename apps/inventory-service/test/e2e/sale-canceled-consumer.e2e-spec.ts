import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
import { ProcessSaleIssueUseCase } from '#/application/use-cases/process-sale-issue.use-case';
import { RevertSaleIssueUseCase } from '#/application/use-cases/revert-sale-issue.use-case';
import { INVENTORY_ITEM_REPOSITORY } from '#/domain/repositories/inventory-item.repository';
import { PROCESSED_EVENT_REPOSITORY } from '#/domain/repositories/processed-event.repository';
import { STOCK_MOVEMENT_REPOSITORY } from '#/domain/repositories/stock-movement.repository';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { ProcessedEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/processed-event.typeorm-entity';
import { StockMovementTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/stock-movement.typeorm-entity';
import { TypeormInventoryItemRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-inventory-item.repository';
import { TypeormProcessedEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-processed-event.repository';
import { TypeormStockMovementRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-stock-movement.repository';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { SaleCanceledConsumer } from '#/interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';
import {
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture
} from '../support/in-memory-inventory-test-doubles';

describe('inventory-service sale cancellation consumer flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let saleCanceledConsumer: SaleCanceledConsumer;
  let saleCompletedConsumer: SaleCompletedConsumer;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        ProcessSaleIssueUseCase,
        RevertSaleIssueUseCase,
        SaleCanceledConsumer,
        SaleCompletedConsumer,
        TypeormInventoryTransactionRunner,
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
          provide: INVENTORY_ITEM_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormInventoryItemRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: STOCK_MOVEMENT_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormStockMovementRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: PROCESSED_EVENT_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormProcessedEventRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: INVENTORY_TRANSACTION_RUNNER,
          useExisting: TypeormInventoryTransactionRunner
        }
      ]
    }).compile();

    application = moduleFixture.createNestApplication();
    await application.init();

    saleCanceledConsumer = application.get(SaleCanceledConsumer);
    saleCompletedConsumer = application.get(SaleCompletedConsumer);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.createQueryBuilder().delete().from(StockMovementTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(ProcessedEventTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(InventoryItemTypeormEntity).execute();
  });

  afterAll(async () => {
    if (application) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('restores stock after a processed sale completion and ignores duplicate cancellation deliveries', async () => {
    const saleCompletedEvent = createSaleCompletedEventFixture();
    const saleCanceledEvent = createSaleCanceledEventFixture();

    await saleCompletedConsumer.handle(saleCompletedEvent);

    const firstResult = await saleCanceledConsumer.handle(saleCanceledEvent);
    const secondResult = await saleCanceledConsumer.handle(saleCanceledEvent);

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('ignored');

    const persistedItem = await dataSource.getRepository(InventoryItemTypeormEntity).findOneByOrFail({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d'
    });
    const persistedMovements = await dataSource
      .getRepository(StockMovementTypeormEntity)
      .find({
        order: {
          occurredAt: 'ASC'
        }
      });
    const persistedProcessedEvents = await dataSource
      .getRepository(ProcessedEventTypeormEntity)
      .find();

    expect(persistedItem.onHandQuantity).toBe(0);
    expect(persistedMovements).toHaveLength(2);
    expect(persistedMovements[0]?.movementType).toBe('SALE_ISSUE');
    expect(persistedMovements[1]?.movementType).toBe('SALE_REVERSION');
    expect(persistedProcessedEvents).toHaveLength(2);
  });

  it('keeps stock unchanged when sale cancellation arrives before sale completion', async () => {
    const saleCompletedEvent = createSaleCompletedEventFixture();
    const saleCanceledEvent = createSaleCanceledEventFixture();

    const cancellationResult = await saleCanceledConsumer.handle(saleCanceledEvent);
    const completionResult = await saleCompletedConsumer.handle(saleCompletedEvent);

    expect(cancellationResult.processingStatus).toBe('skipped');
    expect(completionResult.processingStatus).toBe('skipped');

    const persistedItems = await dataSource.getRepository(InventoryItemTypeormEntity).find();
    const persistedMovements = await dataSource.getRepository(StockMovementTypeormEntity).find();
    const persistedProcessedEvents = await dataSource
      .getRepository(ProcessedEventTypeormEntity)
      .find();

    expect(persistedItems).toHaveLength(0);
    expect(persistedMovements).toHaveLength(0);
    expect(persistedProcessedEvents).toHaveLength(2);
  });
});
