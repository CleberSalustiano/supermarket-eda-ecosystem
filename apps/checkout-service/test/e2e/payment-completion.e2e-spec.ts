import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus, ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import { createProductPriceUpdatedEvent, SalePaymentMethod } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { CHECKOUT_EVENT_PUBLISHER } from '#/application/ports/checkout-event-publisher.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '#/application/ports/checkout-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { CompleteSaleUseCase } from '#/application/use-cases/complete-sale.use-case';
import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { ProcessSalePaymentUseCase } from '#/application/use-cases/process-sale-payment.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';
import { POS_SESSION_REPOSITORY } from '#/domain/repositories/pos-session.repository';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from '#/domain/repositories/product-catalog-item.repository';
import { SALE_REPOSITORY } from '#/domain/repositories/sale.repository';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { ProductCatalogItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product-catalog-item.typeorm-entity';
import { PosSessionTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/pos-session.typeorm-entity';
import { SaleItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale-item.typeorm-entity';
import { SaleTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale.typeorm-entity';
import { TypeormCheckoutTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-checkout-transaction-runner';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormPosSessionRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-pos-session.repository';
import { TypeormProductCatalogItemRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { TypeormSaleRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-sale.repository';
import { PosSessionsController } from '#/interfaces/http/pos-sessions.controller';
import { SalesController } from '#/interfaces/http/sales.controller';
import { ProductPriceUpdatedConsumer } from '#/interfaces/messaging/product-price-updated.consumer';
import { createCheckoutPgMemoryDataSource } from '../support/create-checkout-pg-memory-data-source';

describe('checkout-service payment and completion flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let productPriceUpdatedConsumer: ProductPriceUpdatedConsumer;
  const fakePublisher = {
    publish: jest.fn(async () => undefined)
  };

  beforeAll(async () => {
    dataSource = await createCheckoutPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [PosSessionsController, SalesController],
      providers: [
        AppLoggerService,
        OpenPosSessionUseCase,
        StartSaleUseCase,
        AddSaleItemUseCase,
        RemoveSaleItemUseCase,
        ProcessSalePaymentUseCase,
        CompleteSaleUseCase,
        SynchronizeProductCatalogItemUseCase,
        ProductPriceUpdatedConsumer,
        ReliableOutboxEventRelayService,
        TypeormCheckoutTransactionRunner,
        TypeormOutboxEventRepository,
        {
          provide: SERVICE_ENVIRONMENT,
          useValue: {
            nodeEnvironment: 'test',
            serviceName: 'checkout-service',
            appVersion: '0.1.0',
            servicePort: 3001,
            database: {
              host: 'localhost',
              port: 5433,
              name: 'checkout_service',
              user: 'checkout_user',
              password: 'checkout_password',
              ssl: false
            },
            kafka: {
              brokers: ['localhost:19092'],
              clientId: 'checkout-service',
              consumerGroupId: 'checkout-service'
            }
          }
        },
        {
          provide: DataSource,
          useValue: dataSource
        },
        {
          provide: PRODUCT_CATALOG_ITEM_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormProductCatalogItemRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: POS_SESSION_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormPosSessionRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: SALE_REPOSITORY,
          useFactory: (dataSource: DataSource) => new TypeormSaleRepository(dataSource),
          inject: [DataSource]
        },
        {
          provide: CHECKOUT_TRANSACTION_RUNNER,
          useExisting: TypeormCheckoutTransactionRunner
        },
        {
          provide: CHECKOUT_EVENT_PUBLISHER,
          useValue: fakePublisher
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

    productPriceUpdatedConsumer = application.get(ProductPriceUpdatedConsumer);
  });

  afterEach(async () => {
    fakePublisher.publish.mockClear();

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
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('processes payment, completes the sale, and marks the outbox event as published', async () => {
    await productPriceUpdatedConsumer.handle(
      createProductPriceUpdatedEvent({
        productId: '4be1e5d2-93d0-44fe-a2b8-0dc560889b9b',
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        previousUnitPrice: 8.5,
        active: true
      })
    );

    const openSessionResponse = await request(application.getHttpAdapter().getInstance())
      .post('/pos-sessions')
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        registerId: 'register-01',
        operatorId: '4d8e5af5-1d49-4a55-8ce9-b95959cf63ee',
        openingFloatAmount: 200
      })
      .expect(HttpStatus.CREATED);

    const startSaleResponse = await request(application.getHttpAdapter().getInstance())
      .post('/sales')
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        sessionId: openSessionResponse.body.sessionId
      })
      .expect(HttpStatus.CREATED);

    await request(application.getHttpAdapter().getInstance())
      .post(`/sales/${startSaleResponse.body.saleId}/items`)
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        barcode: '7891000000200',
        quantity: 2
      })
      .expect(HttpStatus.OK);

    const paymentResponse = await request(application.getHttpAdapter().getInstance())
      .post(`/sales/${startSaleResponse.body.saleId}/payment`)
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        paymentMethod: SalePaymentMethod.Cash,
        paidAmount: 20
      })
      .expect(HttpStatus.OK);

    expect(paymentResponse.body).toMatchObject({
      status: 'PAID',
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20,
      changeAmount: 0.2
    });

    const completionResponse = await request(application.getHttpAdapter().getInstance())
      .post(`/sales/${startSaleResponse.body.saleId}/completion`)
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
      })
      .expect(HttpStatus.OK);

    expect(completionResponse.body).toMatchObject({
      status: 'COMPLETED',
      paymentMethod: SalePaymentMethod.Cash,
      eventPublicationStatus: 'published',
      receipt: {
        saleId: startSaleResponse.body.saleId,
        paymentMethod: SalePaymentMethod.Cash,
        totalItemsQuantity: 2,
        total: 19.8
      }
    });

    const persistedSale = await dataSource.getRepository(SaleTypeormEntity).findOneByOrFail({
      id: startSaleResponse.body.saleId
    });
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();

    expect(persistedSale.status).toBe('COMPLETED');
    expect(persistedSale.paymentMethod).toBe(SalePaymentMethod.Cash);
    expect(persistedOutboxEvents).toHaveLength(1);
    expect(persistedOutboxEvents[0]?.publishedAt).not.toBeNull();
    expect(fakePublisher.publish).toHaveBeenCalledTimes(1);
  });
});
