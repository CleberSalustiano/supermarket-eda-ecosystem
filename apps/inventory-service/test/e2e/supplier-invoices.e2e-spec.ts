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

import { INVENTORY_EVENT_PUBLISHER } from '#/application/ports/inventory-event-publisher.port';
import { INVENTORY_TRANSACTION_RUNNER } from '#/application/ports/inventory-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { RegisterSupplierInvoiceUseCase } from '#/application/use-cases/register-supplier-invoice.use-case';
import { InventoryItemTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/inventory-item.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { StockMovementTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/stock-movement.typeorm-entity';
import { SupplierInvoiceLineTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/supplier-invoice-line.typeorm-entity';
import { SupplierInvoiceTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/supplier-invoice.typeorm-entity';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { TypeormInventoryTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { SupplierInvoicesController } from '#/interfaces/http/supplier-invoices.controller';
import { createInventoryPgMemoryDataSource } from '../support/create-inventory-pg-memory-data-source';
import { FakeInventoryEventPublisher } from '../support/in-memory-inventory-test-doubles';

describe('inventory-service supplier invoice flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let inventoryEventPublisher: FakeInventoryEventPublisher;

  beforeAll(async () => {
    dataSource = await createInventoryPgMemoryDataSource();
    inventoryEventPublisher = new FakeInventoryEventPublisher();

    const moduleFixture = await Test.createTestingModule({
      controllers: [SupplierInvoicesController],
      providers: [
        AppLoggerService,
        RegisterSupplierInvoiceUseCase,
        ReliableOutboxEventRelayService,
        TypeormInventoryTransactionRunner,
        TypeormOutboxEventRepository,
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
          provide: INVENTORY_EVENT_PUBLISHER,
          useValue: inventoryEventPublisher
        },
        {
          provide: INVENTORY_TRANSACTION_RUNNER,
          useExisting: TypeormInventoryTransactionRunner
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
  });

  afterEach(async () => {
    if (dataSource?.isInitialized !== true) {
      return;
    }

    inventoryEventPublisher.publishedEvents.length = 0;

    await dataSource.getRepository(OutboxEventTypeormEntity).clear();
    await dataSource.getRepository(StockMovementTypeormEntity).clear();
    await dataSource.getRepository(SupplierInvoiceLineTypeormEntity).clear();
    await dataSource.getRepository(SupplierInvoiceTypeormEntity).clear();
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

  it('registers a supplier invoice, persists the stock receipt, and publishes ProductReceived', async () => {
    const response = await request(application.getHttpAdapter().getInstance())
      .post('/supplier-invoices')
      .send({
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        supplierReference: 'nf-12345',
        receivedAt: '2026-06-12T09:00:00.000Z',
        items: [
          {
            productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
            barcode: '7891000000200',
            name: 'Orange Juice',
            unitOfMeasure: 'unit',
            quantity: 5,
            unitCost: 7.7
          },
          {
            productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
            barcode: '7891000000201',
            name: 'Whole Milk',
            unitOfMeasure: 'unit',
            quantity: 3,
            unitCost: 6.2
          }
        ]
      })
      .expect(201);

    expect(response.body).toMatchObject({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      supplierReference: 'NF-12345',
      totalItemsQuantity: 8,
      totalCost: 57.1,
      eventPublicationStatus: 'published'
    });
    expect(response.body.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
          onHandQuantity: 5,
          averageUnitCost: 7.7
        }),
        expect.objectContaining({
          productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
          onHandQuantity: 3,
          averageUnitCost: 6.2
        })
      ])
    );
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));

    const persistedInvoices = await dataSource.getRepository(SupplierInvoiceTypeormEntity).find();
    const persistedLines = await dataSource.getRepository(SupplierInvoiceLineTypeormEntity).find();
    const persistedItems = await dataSource.getRepository(InventoryItemTypeormEntity).find();
    const persistedMovements = await dataSource.getRepository(StockMovementTypeormEntity).find();
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();

    expect(persistedInvoices).toHaveLength(1);
    expect(persistedLines).toHaveLength(2);
    expect(persistedItems).toHaveLength(2);
    expect(persistedItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
          onHandQuantity: 5,
          averageUnitCost: 7.7
        }),
        expect.objectContaining({
          productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
          onHandQuantity: 3,
          averageUnitCost: 6.2
        })
      ])
    );
    expect(persistedMovements).toHaveLength(2);
    expect(persistedMovements[0]?.movementType).toBe('RECEIPT');
    expect(persistedOutboxEvents).toHaveLength(1);
    expect(persistedOutboxEvents[0]?.publishedAt).toEqual(expect.any(Date));
    expect(inventoryEventPublisher.publishedEvents).toHaveLength(1);
    expect(inventoryEventPublisher.publishedEvents[0]?.eventName).toBe('ProductReceived');
  });
});
