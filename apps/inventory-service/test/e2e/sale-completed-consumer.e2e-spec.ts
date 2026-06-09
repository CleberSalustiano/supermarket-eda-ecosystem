import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { ProcessSaleIssueUseCase } from '#/application/use-cases/process-sale-issue.use-case';
import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
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
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';
import { createSaleCompletedEventFixture } from '../support/in-memory-inventory-test-doubles';

describe('inventory-service sale completion consumer flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let saleCompletedConsumer: SaleCompletedConsumer;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        ProcessSaleIssueUseCase,
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

  it('deducts stock once and ignores duplicate sale completion deliveries', async () => {
    const event = createSaleCompletedEventFixture();

    const firstResult = await saleCompletedConsumer.handle(event);
    const secondResult = await saleCompletedConsumer.handle(event);

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('ignored');

    const persistedItem = await dataSource.getRepository(InventoryItemTypeormEntity).findOneByOrFail({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d'
    });
    const persistedMovements = await dataSource.getRepository(StockMovementTypeormEntity).find();
    const persistedProcessedEvents = await dataSource
      .getRepository(ProcessedEventTypeormEntity)
      .find();

    expect(persistedItem.onHandQuantity).toBe(-3);
    expect(persistedMovements).toHaveLength(1);
    expect(persistedProcessedEvents).toHaveLength(1);
  });
});
