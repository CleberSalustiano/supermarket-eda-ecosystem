import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus, ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import { createProductPriceUpdatedEvent } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { CHECKOUT_TRANSACTION_RUNNER } from '#/application/ports/checkout-transaction-runner.port';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';
import { POS_SESSION_REPOSITORY } from '#/domain/repositories/pos-session.repository';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from '#/domain/repositories/product-catalog-item.repository';
import { SALE_REPOSITORY } from '#/domain/repositories/sale.repository';
import { ProductCatalogItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product-catalog-item.typeorm-entity';
import { PosSessionTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/pos-session.typeorm-entity';
import { SaleItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale-item.typeorm-entity';
import { SaleTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/sale.typeorm-entity';
import { TypeormCheckoutTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-checkout-transaction-runner';
import { TypeormPosSessionRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-pos-session.repository';
import { TypeormProductCatalogItemRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { TypeormSaleRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-sale.repository';
import { PosSessionsController } from '#/interfaces/http/pos-sessions.controller';
import { SalesController } from '#/interfaces/http/sales.controller';
import { ProductPriceUpdatedConsumer } from '#/interfaces/messaging/product-price-updated.consumer';
import { createCheckoutPgMemoryDataSource } from '../support/create-checkout-pg-memory-data-source';

describe('checkout-service session and cart flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let productPriceUpdatedConsumer: ProductPriceUpdatedConsumer;

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
        SynchronizeProductCatalogItemUseCase,
        ProductPriceUpdatedConsumer,
        TypeormCheckoutTransactionRunner,
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
    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.createQueryBuilder().delete().from(SaleItemTypeormEntity).execute();
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

  it('opens a session, starts a sale, adds items, and removes items from the cart', async () => {
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

    const addItemResponse = await request(application.getHttpAdapter().getInstance())
      .post(`/sales/${startSaleResponse.body.saleId}/items`)
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        barcode: '7891000000200',
        quantity: 2
      })
      .expect(HttpStatus.OK);

    expect(addItemResponse.body).toMatchObject({
      totalItemsQuantity: 2,
      subtotal: 19.8,
      items: [
        {
          barcode: '7891000000200',
          quantity: 2,
          lineTotal: 19.8
        }
      ]
    });

    const removeItemResponse = await request(application.getHttpAdapter().getInstance())
      .post(`/sales/${startSaleResponse.body.saleId}/items/removals`)
      .send({
        tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
        barcode: '7891000000200',
        quantity: 1
      })
      .expect(HttpStatus.OK);

    expect(removeItemResponse.body).toMatchObject({
      totalItemsQuantity: 1,
      subtotal: 9.9,
      total: 9.9,
      items: [
        {
          barcode: '7891000000200',
          quantity: 1,
          lineTotal: 9.9
        }
      ]
    });

    const persistedSale = await dataSource.getRepository(SaleTypeormEntity).findOneByOrFail({
      id: startSaleResponse.body.saleId
    });
    const persistedSaleItems = await dataSource.getRepository(SaleItemTypeormEntity).findBy({
      saleId: startSaleResponse.body.saleId
    });

    expect(persistedSale.totalItemsQuantity).toBe(1);
    expect(persistedSale.total).toBe(9.9);
    expect(persistedSaleItems).toHaveLength(1);
    expect(persistedSaleItems[0]?.quantity).toBe(1);
    expect(openSessionResponse.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('returns 409 when opening a second active session for the same register', async () => {
    const payload = {
      tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5',
      registerId: 'register-01',
      operatorId: '4d8e5af5-1d49-4a55-8ce9-b95959cf63ee',
      openingFloatAmount: 200
    };

    await request(application.getHttpAdapter().getInstance())
      .post('/pos-sessions')
      .send(payload)
      .expect(HttpStatus.CREATED);

    const response = await request(application.getHttpAdapter().getInstance())
      .post('/pos-sessions')
      .send(payload)
      .expect(HttpStatus.CONFLICT);

    expect(response.body.message).toContain('already has an open POS session');
  });
});
