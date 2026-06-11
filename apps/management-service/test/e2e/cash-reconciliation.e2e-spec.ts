import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { CompensateCanceledSaleUseCase } from '#/application/use-cases/compensate-canceled-sale.use-case';
import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import { ReconcileRegisterClosureUseCase } from '#/application/use-cases/reconcile-register-closure.use-case';
import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { CashReconciliationTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/cash-reconciliation.typeorm-entity';
import { FinancialEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/financial-entry.typeorm-entity';
import { ProcessedEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/processed-event.typeorm-entity';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { RegisterClosedConsumer } from '#/interfaces/messaging/register-closed.consumer';
import { SaleCanceledConsumer } from '#/interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from '#/interfaces/messaging/sale-completed.consumer';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';
import {
  createRegisterClosedEventFixture,
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture
} from '../support/in-memory-management-test-doubles';

describe('management-service cash reconciliation flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let registerClosedConsumer: RegisterClosedConsumer;
  let saleCanceledConsumer: SaleCanceledConsumer;
  let saleCompletedConsumer: SaleCompletedConsumer;

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      providers: [
        AppLoggerService,
        CompensateCanceledSaleUseCase,
        ConsolidateCompletedSaleUseCase,
        ReconcileRegisterClosureUseCase,
        RegisterClosedConsumer,
        SaleCanceledConsumer,
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

    registerClosedConsumer = application.get(RegisterClosedConsumer);
    saleCanceledConsumer = application.get(SaleCanceledConsumer);
    saleCompletedConsumer = application.get(SaleCompletedConsumer);
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.getRepository(CashReconciliationTypeormEntity).clear();
    await dataSource.getRepository(ProcessedEventTypeormEntity).clear();
    await dataSource.getRepository(FinancialEntryTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('reconciles a register using the net cash drawer balance after a cancellation reversal', async () => {
    await saleCompletedConsumer.handle(createSaleCompletedEventFixture());
    await saleCanceledConsumer.handle(createSaleCanceledEventFixture());

    const result = await registerClosedConsumer.handle(
      createRegisterClosedEventFixture({
        declaredCashAmount: 100
      })
    );

    expect(result).toMatchObject({
      processingStatus: 'processed',
      expectedCashAmount: 100,
      differenceAmount: 0,
      reconciliationStatus: 'BALANCED'
    });

    const persistedReconciliation = await dataSource
      .getRepository(CashReconciliationTypeormEntity)
      .findOneByOrFail({
        sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424'
      });

    expect(persistedReconciliation.expectedCashAmount).toBe(100);
    expect(persistedReconciliation.status).toBe('BALANCED');
  });

  it('keeps the drawer expectation at the opening float when cancellation arrives before sale completion', async () => {
    await saleCanceledConsumer.handle(createSaleCanceledEventFixture());
    await saleCompletedConsumer.handle(createSaleCompletedEventFixture());

    const result = await registerClosedConsumer.handle(
      createRegisterClosedEventFixture({
        declaredCashAmount: 100
      })
    );

    expect(result).toMatchObject({
      processingStatus: 'processed',
      expectedCashAmount: 100,
      differenceAmount: 0,
      reconciliationStatus: 'BALANCED'
    });

    const persistedEntries = await dataSource.getRepository(FinancialEntryTypeormEntity).find();

    expect(persistedEntries).toHaveLength(0);
  });
});
