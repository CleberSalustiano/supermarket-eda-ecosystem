import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import { newDb } from 'pg-mem';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { EmployeeRole } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { RegisterEmployeeUseCase } from '../../src/application/use-cases/register-employee.use-case';
import { RegisterProductUseCase } from '../../src/application/use-cases/register-product.use-case';
import { UpdateProductPriceUseCase } from '../../src/application/use-cases/update-product-price.use-case';
import { CREDENTIAL_HASHER } from '../../src/application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from '../../src/application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../../src/application/ports/management-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '../../src/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '../../src/application/ports/outbox-event-repository.port';
import { ReliableOutboxEventRelayService } from '../../src/infrastructure/events/reliable-outbox-event-relay.service';
import { managementTypeormEntities } from '../../src/infrastructure/persistence/typeorm/entities/management-typeorm-entities';
import { OutboxEventTypeormEntity } from '../../src/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { ProductTypeormEntity } from '../../src/infrastructure/persistence/typeorm/entities/product.typeorm-entity';
import { EmployeeTypeormEntity } from '../../src/infrastructure/persistence/typeorm/entities/employee.typeorm-entity';
import { TypeormOutboxEventRepository } from '../../src/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from '../../src/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from '../../src/infrastructure/security/scrypt-credential-hasher.service';
import { EmployeesController } from '../../src/interfaces/http/employees.controller';
import { ProductsController } from '../../src/interfaces/http/products.controller';
import { HealthController } from '../../src/interfaces/http/health.controller';

describe('management-service catalog flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  const fakePublisher = {
    publish: jest.fn(async () => undefined)
  };

  beforeAll(async () => {
    dataSource = await createPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [HealthController, ProductsController, EmployeesController],
      providers: [
        AppLoggerService,
        RegisterEmployeeUseCase,
        RegisterProductUseCase,
        UpdateProductPriceUseCase,
        ReliableOutboxEventRelayService,
        ScryptCredentialHasherService,
        TypeormManagementTransactionRunner,
        TypeormOutboxEventRepository,
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
          provide: CREDENTIAL_HASHER,
          useExisting: ScryptCredentialHasherService
        },
        {
          provide: MANAGEMENT_EVENT_PUBLISHER,
          useValue: fakePublisher
        },
        {
          provide: MANAGEMENT_TRANSACTION_RUNNER,
          useExisting: TypeormManagementTransactionRunner
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
    fakePublisher.publish.mockClear();

    if (dataSource?.isInitialized !== true) {
      return;
    }

    await dataSource.getRepository(OutboxEventTypeormEntity).clear();
    await dataSource.getRepository(ProductTypeormEntity).clear();
    await dataSource.getRepository(EmployeeTypeormEntity).clear();
  });

  afterAll(async () => {
    if (application !== undefined) {
      await application.close();
    }

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  it('registers a product and marks the outbox event as published', async () => {
    const response = await request(application.getHttpAdapter().getInstance())
      .post('/products')
      .send({
        tenantId: '4d73874c-36a5-421a-8853-a55747947b6e',
        name: 'Orange Juice',
        barcode: '7891000000200',
        unitOfMeasure: 'unit',
        price: 9.9
      })
      .expect(201);

    expect(response.body).toMatchObject({
      barcode: '7891000000200',
      eventPublicationStatus: 'published'
    });
    expect(fakePublisher.publish).toHaveBeenCalledTimes(1);

    const persistedProduct = await dataSource.getRepository(ProductTypeormEntity).findOneByOrFail({
      id: response.body.productId
    });
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();

    expect(persistedProduct.currentPrice).toBe(9.9);
    expect(persistedOutboxEvents[0]?.publishedAt).not.toBeNull();
  });

  it('updates a product price and stores the new event', async () => {
    const productRepository = dataSource.getRepository(ProductTypeormEntity);
    const createdProduct = await productRepository.save({
      id: '8f00f428-c6d9-49db-95f7-5c6112f58be0',
      tenantId: '7a74ea21-3718-4e6f-aa74-77119439c713',
      name: 'Whole Milk',
      barcode: '7891000000201',
      unitOfMeasure: 'UNIT',
      currentPrice: 6.4,
      active: true
    });

    const response = await request(application.getHttpAdapter().getInstance())
      .put(`/products/${createdProduct.id}/price`)
      .send({
        tenantId: createdProduct.tenantId,
        price: 6.99
      })
      .expect(200);

    expect(response.body).toMatchObject({
      previousPrice: 6.4,
      currentPrice: 6.99,
      eventPublicationStatus: 'published'
    });

    const persistedProduct = await productRepository.findOneByOrFail({
      id: createdProduct.id
    });

    expect(persistedProduct.currentPrice).toBe(6.99);
    expect(fakePublisher.publish).toHaveBeenCalledTimes(1);
  });

  it('registers an employee and persists a hashed PIN', async () => {
    const response = await request(application.getHttpAdapter().getInstance())
      .post('/employees')
      .send({
        tenantId: 'd301db50-a5d3-44f9-b1a6-01dce3ea4054',
        employeeCode: 'cx-22',
        fullName: 'Diana Cashier',
        role: EmployeeRole.Cashier,
        pin: '3456'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      employeeCode: 'CX-22',
      role: EmployeeRole.Cashier,
      eventPublicationStatus: 'published'
    });

    const persistedEmployee = await dataSource.getRepository(EmployeeTypeormEntity).findOneByOrFail({
      id: response.body.employeeId
    });

    expect(persistedEmployee.pinHash).not.toBe('3456');
    expect(persistedEmployee.pinHash).toContain(':');
    expect(fakePublisher.publish).toHaveBeenCalledTimes(1);
  });
});

async function createPgMemoryDataSource(): Promise<DataSource> {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });

  database.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem_management'
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

  const dataSource = await database.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [...managementTypeormEntities],
    synchronize: true,
    logging: false
  });

  await dataSource.initialize();

  return dataSource;
}
