import { HttpStatus, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import {
  SALE_CANCELED_EVENT_NAME,
  SALE_COMPLETED_EVENT_NAME,
  SalePaymentMethod
} from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter
} from '@supermarket/shared-infra';

import type {
  CheckoutTransactionContext,
  CheckoutTransactionRunnerPort
} from '#/application/ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '#/application/ports/checkout-transaction-runner.port';
import { MANAGER_APPROVAL_VERIFIER } from '#/application/ports/manager-approval-verifier.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { CancelSaleUseCase } from '#/application/use-cases/cancel-sale.use-case';
import { CompleteSaleUseCase } from '#/application/use-cases/complete-sale.use-case';
import { ProcessSalePaymentUseCase } from '#/application/use-cases/process-sale-payment.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import { Sale } from '#/domain/entities/sale.entity';
import type { SaleRepositoryPort } from '#/domain/repositories/sale.repository';
import { createCheckoutDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { PosSessionTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/pos-session.typeorm-entity';
import { ProductCatalogItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product-catalog-item.typeorm-entity';
import { SaleItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale-item.typeorm-entity';
import { SaleTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale.typeorm-entity';
import { TypeormPosSessionRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-pos-session.repository';
import { TypeormProductCatalogItemRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { TypeormSaleRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-sale.repository';
import { TypeormCheckoutTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-checkout-transaction-runner';
import { SalesController } from '#/interfaces/http/sales.controller';
import {
  FakeManagerApprovalVerifier,
  FakeOutboxEventRelay
} from '../support/in-memory-checkout-test-doubles';

const tenantId = '0c5f3c9e-7f43-4c55-9a77-5a3cf6b7e2d1';
const sessionId = '8e2b6d1a-4c3f-4f7e-9b1d-2a6c5e8f7d90';
const productId = '1f6e9d2c-3b4a-4c5d-8e7f-6a5b4c3d2e1f';
const barcode = '7891000000200';
const approver = {
  employeeId: '5d4c3b2a-1f0e-4d9c-8b7a-6f5e4d3c2b1a',
  employeeCode: 'MANAGER-01',
  fullName: 'Bruno Lima'
};
const readDelayMs = 300;

/**
 * Wraps the real transaction runner and pauses after every sale read, so two
 * concurrent requests overlap inside their transactions. Without the row lock
 * both would read the same state and both would commit.
 */
class DelayedSaleReadTransactionRunner implements CheckoutTransactionRunnerPort {
  constructor(private readonly runner: TypeormCheckoutTransactionRunner) {}

  async execute<T>(work: (context: CheckoutTransactionContext) => Promise<T>): Promise<T> {
    return this.runner.execute((context) =>
      work({ ...context, saleRepository: delayReads(context.saleRepository) })
    );
  }
}

function delayReads(repository: SaleRepositoryPort): SaleRepositoryPort {
  return {
    findById: async (...args) => afterDelay(await repository.findById(...args)),
    findByIdForUpdate: async (...args) => afterDelay(await repository.findByIdForUpdate(...args)),
    hasNonTerminalBySessionId: (...args) => repository.hasNonTerminalBySessionId(...args),
    save: (sale) => repository.save(sale)
  };
}

async function afterDelay<T>(value: T): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, readDelayMs));

  return value;
}

describe('checkout-service concurrent sale mutations (PostgreSQL row locks)', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;
  let application: INestApplication;
  const verifier = new FakeManagerApprovalVerifier(async () => ({
    outcome: 'APPROVED',
    approver
  }));

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'checkout_service',
        POSTGRES_USER: 'checkout_user',
        POSTGRES_PASSWORD: 'checkout_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createCheckoutDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'checkout_user',
        password: 'checkout_password',
        database: 'checkout_service',
        migrationsRun: false,
        logging: false
      })
    );
    await dataSource.initialize();
    await dataSource.runMigrations();

    const moduleFixture = await Test.createTestingModule({
      controllers: [SalesController],
      providers: [
        AppLoggerService,
        StartSaleUseCase,
        AddSaleItemUseCase,
        RemoveSaleItemUseCase,
        ProcessSalePaymentUseCase,
        CompleteSaleUseCase,
        CancelSaleUseCase,
        {
          provide: CHECKOUT_TRANSACTION_RUNNER,
          useValue: new DelayedSaleReadTransactionRunner(
            new TypeormCheckoutTransactionRunner(dataSource)
          )
        },
        { provide: OUTBOX_EVENT_RELAY, useValue: new FakeOutboxEventRelay('published') },
        { provide: MANAGER_APPROVAL_VERIFIER, useValue: verifier }
      ]
    }).compile();

    application = moduleFixture.createNestApplication({ logger: false });
    application.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true })
    );
    application.useGlobalInterceptors(new CorrelationIdInterceptor());
    application.useGlobalFilters(new GlobalHttpExceptionFilter(application.get(AppLoggerService)));
    await application.init();
  }, 120000);

  afterEach(async () => {
    verifier.calls.length = 0;

    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.createQueryBuilder().delete().from(SaleItemTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(OutboxEventTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(SaleTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(PosSessionTypeormEntity).execute();
    await dataSource.createQueryBuilder().delete().from(ProductCatalogItemTypeormEntity).execute();
  });

  afterAll(async () => {
    if (application) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }

    if (container !== undefined) {
      await container.stop();
    }
  }, 120000);

  function http() {
    return request(application.getHttpAdapter().getInstance());
  }

  async function seedSale(stage: 'OPEN' | 'PAID' | 'COMPLETED'): Promise<string> {
    const saleId = crypto.randomUUID();

    await new TypeormProductCatalogItemRepository(dataSource).save(
      ProductCatalogItem.synchronize({
        productId,
        tenantId,
        barcode,
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        active: true,
        priceUpdatedAt: new Date('2026-06-01T00:00:00.000Z')
      })
    );
    await new TypeormPosSessionRepository(dataSource).save(
      PosSession.open({
        id: sessionId,
        tenantId,
        registerId: 'register-07',
        operatorId: '2b3c4d5e-6f70-4a81-9b2c-3d4e5f607182',
        openingFloatAmount: 100
      })
    );

    const sale = Sale.start({ id: saleId, tenantId, sessionId });

    sale.addItem({
      productId,
      barcode,
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });

    if (stage !== 'OPEN') {
      sale.registerPayment({ paymentMethod: SalePaymentMethod.Cash, paidAmount: 20 });
    }

    if (stage === 'COMPLETED') {
      sale.complete();
    }

    await new TypeormSaleRepository(dataSource).save(sale);

    return saleId;
  }

  async function outboxEventsNamed(eventName: string): Promise<OutboxEventTypeormEntity[]> {
    return dataSource.getRepository(OutboxEventTypeormEntity).find({ where: { eventName } });
  }

  it('commits exactly one of two concurrent cancellations and writes one SaleCanceled', async () => {
    const saleId = await seedSale('COMPLETED');
    const cancel = (reason: string) =>
      http()
        .post(`/sales/${saleId}/cancellation`)
        .send({ tenantId, reason, managerApproval: { employeeCode: 'MANAGER-01', pin: '2468' } });

    const responses = await Promise.all([cancel('First register'), cancel('Second register')]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      HttpStatus.OK,
      HttpStatus.CONFLICT
    ]);
    // Both requests passed the read phase and were approved: the lock decided.
    expect(verifier.calls).toHaveLength(2);

    const winner = responses.find((response) => response.status === HttpStatus.OK)!;
    const loser = responses.find((response) => response.status === HttpStatus.CONFLICT)!;
    const canceledEvents = await outboxEventsNamed(SALE_CANCELED_EVENT_NAME);
    const persistedSale = await dataSource
      .getRepository(SaleTypeormEntity)
      .findOneByOrFail({ id: saleId });

    expect(loser.body.message).toBe(`Sale ${saleId} is already canceled for tenant ${tenantId}`);
    expect(canceledEvents).toHaveLength(1);
    expect(persistedSale.status).toBe('CANCELED');
    expect(persistedSale.cancellationReason).toBe(winner.body.cancellationReason);
    expect(canceledEvents[0]?.payload).toMatchObject({
      previousStatus: 'COMPLETED',
      cancellationReason: winner.body.cancellationReason,
      approvedByEmployeeId: approver.employeeId
    });
  }, 30000);

  it('commits exactly one of two concurrent completions and writes one SaleCompleted', async () => {
    const saleId = await seedSale('PAID');
    const complete = () => http().post(`/sales/${saleId}/completion`).send({ tenantId });

    const responses = await Promise.all([complete(), complete()]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      HttpStatus.OK,
      HttpStatus.CONFLICT
    ]);
    expect(await outboxEventsNamed(SALE_COMPLETED_EVENT_NAME)).toHaveLength(1);
  }, 30000);

  it('accepts exactly one of two concurrent payments', async () => {
    const saleId = await seedSale('OPEN');
    const pay = (paidAmount: number) =>
      http()
        .post(`/sales/${saleId}/payment`)
        .send({ tenantId, paymentMethod: SalePaymentMethod.Cash, paidAmount });

    const responses = await Promise.all([pay(20), pay(50)]);
    const winner = responses.find((response) => response.status === HttpStatus.OK);
    const persistedSale = await dataSource
      .getRepository(SaleTypeormEntity)
      .findOneByOrFail({ id: saleId });

    expect(responses.map((response) => response.status).sort()).toEqual([
      HttpStatus.OK,
      HttpStatus.CONFLICT
    ]);
    expect(persistedSale.paidAmount).toBe(winner?.body.paidAmount);
  }, 30000);

  it('keeps both of two concurrent item scans instead of losing one', async () => {
    const saleId = await seedSale('OPEN');
    const scan = () =>
      http().post(`/sales/${saleId}/items`).send({ tenantId, barcode, quantity: 1 });

    const responses = await Promise.all([scan(), scan()]);
    const items = await dataSource.getRepository(SaleItemTypeormEntity).find({
      where: { saleId }
    });

    expect(responses.map((response) => response.status)).toEqual([HttpStatus.OK, HttpStatus.OK]);
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe(3);
  }, 30000);
});
