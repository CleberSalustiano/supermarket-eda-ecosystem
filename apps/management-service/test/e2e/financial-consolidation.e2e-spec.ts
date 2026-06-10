import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { DailyFinancialConsolidationTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/daily-financial-consolidation.typeorm-entity';
import { FinancialEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/financial-entry.typeorm-entity';
import { TypeormDailyFinancialConsolidationRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-daily-financial-consolidation.repository';
import { TypeormFinancialEntryRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-financial-entry.repository';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';
import { createSaleCompletedEventFixture } from '../support/in-memory-management-test-doubles';

describe('management-service financial consolidation flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let saleCompletedConsumer: SaleCompletedConsumer;

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        ConsolidateCompletedSaleUseCase,
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
    await application.init();

    saleCompletedConsumer = application.get(SaleCompletedConsumer);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.getRepository(FinancialEntryTypeormEntity).clear();
    await dataSource.getRepository(DailyFinancialConsolidationTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('consolidates a completed sale once and ignores duplicate deliveries', async () => {
    const event = createSaleCompletedEventFixture();

    const firstResult = await saleCompletedConsumer.handle(event);
    const secondResult = await saleCompletedConsumer.handle(event);

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('ignored');

    const persistedEntries = await dataSource.getRepository(FinancialEntryTypeormEntity).find();
    const persistedConsolidation = await dataSource
      .getRepository(DailyFinancialConsolidationTypeormEntity)
      .findOneByOrFail({
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        businessDate: '2026-06-09'
      });

    expect(persistedEntries).toHaveLength(1);
    expect(persistedConsolidation.grossSalesTotal).toBe(42.5);
    expect(persistedConsolidation.salesCount).toBe(1);
    expect(persistedConsolidation.soldItemsQuantity).toBe(3);
  });
});
