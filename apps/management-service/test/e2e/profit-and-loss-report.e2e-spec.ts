import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus, ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { CaptureInventoryLossUseCase } from '#/application/use-cases/capture-inventory-loss.use-case';
import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import { GenerateProfitAndLossReportUseCase } from '#/application/use-cases/generate-profit-and-loss-report.use-case';
import { FinancialEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/financial-entry.typeorm-entity';
import { InventoryLossEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-loss-entry.typeorm-entity';
import { ProcessedEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/processed-event.typeorm-entity';
import { ProductTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product.typeorm-entity';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ReportsController } from '#/interfaces/http/reports.controller';
import { InventoryLossRegisteredConsumer } from '#/interfaces/messaging/inventory-loss-registered.consumer';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';
import {
  createInventoryLossRegisteredEventFixture,
  createSaleCompletedEventFixture
} from '../support/in-memory-management-test-doubles';

describe('management-service profit and loss report flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let inventoryLossRegisteredConsumer: InventoryLossRegisteredConsumer;
  let saleCompletedConsumer: SaleCompletedConsumer;

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        AppLoggerService,
        CaptureInventoryLossUseCase,
        ConsolidateCompletedSaleUseCase,
        GenerateProfitAndLossReportUseCase,
        InventoryLossRegisteredConsumer,
        SaleCompletedConsumer,
        TypeormManagementTransactionRunner,
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
          provide: MANAGEMENT_TRANSACTION_RUNNER,
          useExisting: TypeormManagementTransactionRunner
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

    inventoryLossRegisteredConsumer = application.get(InventoryLossRegisteredConsumer);
    saleCompletedConsumer = application.get(SaleCompletedConsumer);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.getRepository(ProcessedEventTypeormEntity).clear();
    await dataSource.getRepository(FinancialEntryTypeormEntity).clear();
    await dataSource.getRepository(InventoryLossEntryTypeormEntity).clear();
    await dataSource.getRepository(ProductTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('returns a consolidated report after revenue and loss events are captured', async () => {
    await dataSource.getRepository(ProductTypeormEntity).save({
      id: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
      tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
      name: 'Ground Coffee',
      barcode: '7891000000410',
      unitOfMeasure: 'UNIT',
      currentPrice: 14.17,
      active: true
    });

    await saleCompletedConsumer.handle(createSaleCompletedEventFixture());
    await inventoryLossRegisteredConsumer.handle(createInventoryLossRegisteredEventFixture());

    const response = await request(application.getHttpAdapter().getInstance())
      .get('/reports/profit-and-loss')
      .query({
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        fromDate: '2026-06-09',
        toDate: '2026-06-09'
      })
      .expect(HttpStatus.OK);

    expect(response.body).toEqual({
      tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
      fromDate: '2026-06-09',
      toDate: '2026-06-09',
      revenueNetTotal: 42.5,
      inventoryLossTotal: 28.34,
      profitAndLossTotal: 14.16,
      netSalesCount: 1,
      soldItemsQuantity: 3,
      lossEventsCount: 1,
      lossItemsQuantity: 2,
      days: [
        {
          businessDate: '2026-06-09',
          revenueNetTotal: 42.5,
          inventoryLossTotal: 28.34,
          profitAndLossTotal: 14.16,
          netSalesCount: 1,
          soldItemsQuantity: 3,
          lossEventsCount: 1,
          lossItemsQuantity: 2
        }
      ]
    });
  });
});
