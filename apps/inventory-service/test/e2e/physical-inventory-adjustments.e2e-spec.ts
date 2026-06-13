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

import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
import { RegisterPhysicalInventoryAdjustmentUseCase } from '#/application/use-cases/register-physical-inventory-adjustment.use-case';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { PhysicalInventoryAdjustmentTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/physical-inventory-adjustment.typeorm-entity';
import { StockMovementTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/stock-movement.typeorm-entity';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { PhysicalInventoryAdjustmentsController } from '#/interfaces/http/physical-inventory-adjustments.controller';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';

describe('inventory-service physical inventory adjustment flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [PhysicalInventoryAdjustmentsController],
      providers: [
        AppLoggerService,
        RegisterPhysicalInventoryAdjustmentUseCase,
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
          provide: INVENTORY_TRANSACTION_RUNNER,
          useExisting: TypeormInventoryTransactionRunner
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

    await dataSource.getRepository(PhysicalInventoryAdjustmentTypeormEntity).clear();
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

  it('records a physical inventory adjustment and persists the stock movement audit trail', async () => {
    await dataSource.getRepository(InventoryItemTypeormEntity).save({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      onHandQuantity: 9,
      minimumThreshold: 2,
      averageUnitCost: 7.7,
      lastLowStockAlertAt: null,
      createdAt: new Date('2026-06-13T08:00:00.000Z'),
      updatedAt: new Date('2026-06-13T08:00:00.000Z')
    });

    const response = await request(application.getHttpAdapter().getInstance())
      .post('/inventory-adjustments/physical')
      .send({
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        barcode: '7891000000201',
        name: 'Orange Juice Counted',
        unitOfMeasure: 'box',
        countedQuantity: 4,
        minimumThreshold: 5,
        reason: 'Cycle count correction',
        collectorId: '6e12f561-6714-4a95-a4c6-c65b4d0f5166',
        occurredAt: '2026-06-13T09:00:00.000Z'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantityDelta: -5,
      onHandQuantity: 4,
      minimumThreshold: 5
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));

    const persistedItems = await dataSource.getRepository(InventoryItemTypeormEntity).find();
    const persistedAdjustments = await dataSource
      .getRepository(PhysicalInventoryAdjustmentTypeormEntity)
      .find();
    const persistedMovements = await dataSource.getRepository(StockMovementTypeormEntity).find();

    expect(persistedItems).toEqual([
      expect.objectContaining({
        barcode: '7891000000201',
        name: 'Orange Juice Counted',
        unitOfMeasure: 'BOX',
        onHandQuantity: 4,
        minimumThreshold: 5
      })
    ]);
    expect(persistedAdjustments).toEqual([
      expect.objectContaining({
        previousOnHandQuantity: 9,
        countedQuantity: 4,
        quantityDelta: -5,
        minimumThreshold: 5,
        reason: 'Cycle count correction'
      })
    ]);
    expect(persistedMovements).toEqual([
      expect.objectContaining({
        movementType: 'PHYSICAL_ADJUSTMENT',
        quantityDelta: -5
      })
    ]);
  });
});
