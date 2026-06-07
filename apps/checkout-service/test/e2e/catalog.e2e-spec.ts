import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import { newDb } from 'pg-mem';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { createProductPriceUpdatedEvent } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { ScanProductByBarcodeUseCase } from '#/application/use-cases/scan-product-by-barcode.use-case';
import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from '#/domain/repositories/product-catalog-item.repository';
import { createCheckoutDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { checkoutTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/checkout-typeorm-entities';
import { ProductCatalogItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/product-catalog-item.typeorm-entity';
import { TypeormProductCatalogItemRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { ProductCatalogController } from '#/interfaces/http/product-catalog.controller';
import { ProductPriceUpdatedConsumer } from '#/interfaces/messaging/product-price-updated.consumer';

describe('checkout-service local product catalog flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let productPriceUpdatedConsumer: ProductPriceUpdatedConsumer;

  beforeAll(async () => {
    dataSource = await createPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [ProductCatalogController],
      providers: [
        AppLoggerService,
        ScanProductByBarcodeUseCase,
        SynchronizeProductCatalogItemUseCase,
        ProductPriceUpdatedConsumer,
        TypeormProductCatalogItemRepository,
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
          useExisting: TypeormProductCatalogItemRepository
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

    await dataSource.getRepository(ProductCatalogItemTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('synchronizes a price update event and resolves the product locally by barcode', async () => {
    const event = createProductPriceUpdatedEvent({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      previousUnitPrice: 8.5,
      active: true
    });

    await productPriceUpdatedConsumer.handle(event);

    const response = await request(application.getHttpAdapter().getInstance())
      .get(`/catalog-items/barcodes/${event.payload.barcode}`)
      .query({
        tenantId: event.payload.tenantId
      })
      .expect(200);

    expect(response.body).toMatchObject({
      productId: event.payload.productId,
      tenantId: event.payload.tenantId,
      barcode: event.payload.barcode,
      name: event.payload.name,
      unitPrice: event.payload.unitPrice
    });
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('returns 404 when the barcode is not available in the local cache', async () => {
    const response = await request(application.getHttpAdapter().getInstance())
      .get('/catalog-items/barcodes/7891000000999')
      .query({
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860'
      })
      .expect(404);

    expect(response.body.message).toContain('was not found in the local catalog');
  });

  it('returns 409 when the locally cached product is inactive', async () => {
    const event = createProductPriceUpdatedEvent({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      previousUnitPrice: 8.5,
      active: false
    });

    await productPriceUpdatedConsumer.handle(event);

    const response = await request(application.getHttpAdapter().getInstance())
      .get(`/catalog-items/barcodes/${event.payload.barcode}`)
      .query({
        tenantId: event.payload.tenantId
      })
      .expect(409);

    expect(response.body.message).toContain('is inactive');
  });
});

async function createPgMemoryDataSource(): Promise<DataSource> {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });

  database.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem_checkout'
  });
  database.public.registerFunction({
    name: 'version',
    implementation: () => 'pg-mem'
  });
  database.public.registerFunction({
    name: 'quote_ident',
    args: ['text'],
    implementation: (value: string) => value
  });
  database.public.registerFunction({
    name: 'obj_description',
    args: ['regclass', 'text'],
    implementation: () => null
  });

  const dataSource = await database.adapters.createTypeormDataSource(
    createCheckoutDataSourceOptions({
      type: 'postgres',
      entities: [...checkoutTypeormEntities],
      synchronize: true,
      logging: false
    })
  );

  await dataSource.initialize();

  return dataSource;
}
