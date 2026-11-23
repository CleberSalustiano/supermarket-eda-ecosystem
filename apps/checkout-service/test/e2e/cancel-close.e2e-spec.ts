import { createServer, type IncomingHttpHeaders, type Server, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';

import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { HttpStatus, ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import {
  SalePaymentMethod,
  createProductPriceUpdatedEvent
} from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  GlobalHttpExceptionFilter,
  SERVICE_ENVIRONMENT
} from '@supermarket/shared-infra';

import { CHECKOUT_EVENT_PUBLISHER } from '#/application/ports/checkout-event-publisher.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '#/application/ports/checkout-transaction-runner.port';
import type {
  ManagerApprovalVerificationContext,
  ManagerApprovalVerifierPort
} from '#/application/ports/manager-approval-verifier.port';
import { MANAGER_APPROVAL_VERIFIER } from '#/application/ports/manager-approval-verifier.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { CancelSaleUseCase } from '#/application/use-cases/cancel-sale.use-case';
import { ClosePosSessionUseCase } from '#/application/use-cases/close-pos-session.use-case';
import { CompleteSaleUseCase } from '#/application/use-cases/complete-sale.use-case';
import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { ProcessSalePaymentUseCase } from '#/application/use-cases/process-sale-payment.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';
import { POS_SESSION_REPOSITORY } from '#/domain/repositories/pos-session.repository';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from '#/domain/repositories/product-catalog-item.repository';
import { SALE_REPOSITORY } from '#/domain/repositories/sale.repository';
import { createManagementApprovalClientOptions } from '#/infrastructure/config/management-approval-client.options';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { ManagementApprovalVerifierAdapter } from '#/infrastructure/http/management-approval-verifier.adapter';
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

const tenantId = '3470d47b-0701-4c53-9976-46bd59900fd5';
const internalApiToken = 'checkout-e2e-internal-token-0123456789abcdef';
const managerPin = '913572';
const approver = {
  employeeId: '6a1f0d52-8f8e-4f43-9d0c-6f2d0b6f3a11',
  employeeCode: 'MANAGER-01',
  fullName: 'Bruno Lima'
};

interface RecordedManagementRequest {
  method: string | undefined;
  url: string | undefined;
  headers: IncomingHttpHeaders;
  body: unknown;
}

type StubResponder = (response: ServerResponse) => void;

/** A real HTTP server standing in for management-service's internal endpoint. */
class ManagementStubServer {
  readonly requests: RecordedManagementRequest[] = [];
  private responder: StubResponder = respondJson(200, { outcome: 'DENIED', approver: null });
  private server: Server | undefined;
  private port = 0;

  get baseUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  respondWith(responder: StubResponder): void {
    this.responder = responder;
  }

  reset(): void {
    this.requests.length = 0;
    this.responder = respondJson(200, { outcome: 'DENIED', approver: null });
  }

  async start(): Promise<void> {
    this.server = createServer((request, response) => {
      const chunks: Buffer[] = [];

      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const rawBody = Buffer.concat(chunks).toString('utf8');

        this.requests.push({
          method: request.method,
          url: request.url,
          headers: request.headers,
          body: rawBody.length > 0 ? JSON.parse(rawBody) : undefined
        });
        this.responder(response);
      });
    });

    await new Promise<void>((resolve) => this.server!.listen(0, '127.0.0.1', resolve));
    this.port = (this.server.address() as AddressInfo).port;
  }

  async stop(): Promise<void> {
    if (!this.server?.listening) {
      return;
    }

    this.server.closeAllConnections();
    await new Promise<void>((resolve) => this.server!.close(() => resolve()));
  }
}

/**
 * Real adapters with two timeouts: a generous one so ordinary cases never time
 * out on a loaded machine, and MANAGEMENT_APPROVAL_TIMEOUT_MS=200 for the
 * timeout case.
 */
class SwitchableManagementVerifier implements ManagerApprovalVerifierPort {
  private active: ManagerApprovalVerifierPort;

  constructor(
    private readonly standard: ManagerApprovalVerifierPort,
    private readonly shortTimeout: ManagerApprovalVerifierPort
  ) {
    this.active = standard;
  }

  useShortTimeout(): void {
    this.active = this.shortTimeout;
  }

  reset(): void {
    this.active = this.standard;
  }

  verify(
    request: Parameters<ManagerApprovalVerifierPort['verify']>[0],
    context: ManagerApprovalVerificationContext
  ) {
    return this.active.verify(request, context);
  }
}

function respondJson(status: number, body: unknown, delayMs = 0): StubResponder {
  return (response) => {
    const timer = setTimeout(() => {
      if (response.destroyed) {
        return;
      }

      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(body));
    }, delayMs);

    response.on('close', () => clearTimeout(timer));
  };
}

describe('checkout-service cancel and close flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let productPriceUpdatedConsumer: ProductPriceUpdatedConsumer;
  let logger: AppLoggerService;
  let verifier: SwitchableManagementVerifier;
  const managementStub = new ManagementStubServer();
  const fakePublisher = {
    publish: jest.fn(async () => undefined)
  };

  beforeAll(async () => {
    await managementStub.start();
    dataSource = await createCheckoutPgMemoryDataSource();

    const clientOptions = (timeoutMs: string) =>
      createManagementApprovalClientOptions('test', {
        MANAGEMENT_SERVICE_BASE_URL: managementStub.baseUrl,
        MANAGEMENT_INTERNAL_API_TOKEN: internalApiToken,
        MANAGEMENT_APPROVAL_TIMEOUT_MS: timeoutMs
      });

    const moduleFixture = await Test.createTestingModule({
      controllers: [PosSessionsController, SalesController],
      providers: [
        AppLoggerService,
        OpenPosSessionUseCase,
        ClosePosSessionUseCase,
        StartSaleUseCase,
        AddSaleItemUseCase,
        RemoveSaleItemUseCase,
        ProcessSalePaymentUseCase,
        CompleteSaleUseCase,
        CancelSaleUseCase,
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
          useFactory: (configuredDataSource: DataSource) =>
            new TypeormProductCatalogItemRepository(configuredDataSource),
          inject: [DataSource]
        },
        {
          provide: POS_SESSION_REPOSITORY,
          useFactory: (configuredDataSource: DataSource) =>
            new TypeormPosSessionRepository(configuredDataSource),
          inject: [DataSource]
        },
        {
          provide: SALE_REPOSITORY,
          useFactory: (configuredDataSource: DataSource) =>
            new TypeormSaleRepository(configuredDataSource),
          inject: [DataSource]
        },
        {
          provide: CHECKOUT_TRANSACTION_RUNNER,
          useExisting: TypeormCheckoutTransactionRunner
        },
        {
          provide: MANAGER_APPROVAL_VERIFIER,
          useFactory: (appLogger: AppLoggerService) =>
            new SwitchableManagementVerifier(
              new ManagementApprovalVerifierAdapter(clientOptions('5000'), appLogger),
              new ManagementApprovalVerifierAdapter(clientOptions('200'), appLogger)
            ),
          inject: [AppLoggerService]
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
    logger = application.get(AppLoggerService);
    application.useGlobalFilters(new GlobalHttpExceptionFilter(logger));

    await application.init();

    productPriceUpdatedConsumer = application.get(ProductPriceUpdatedConsumer);
    verifier = application.get(MANAGER_APPROVAL_VERIFIER);
  });

  beforeEach(() => {
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      jest.spyOn(logger, method).mockImplementation(() => undefined);
    }
  });

  afterEach(async () => {
    expectNoPinInLogs();
    jest.restoreAllMocks();
    fakePublisher.publish.mockClear();
    managementStub.reset();
    verifier.reset();

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

    await managementStub.stop();
  });

  function http() {
    return request(application.getHttpAdapter().getInstance());
  }

  function expectNoPinInLogs(): void {
    for (const method of ['log', 'warn', 'error', 'debug', 'verbose'] as const) {
      const calls = (logger[method] as unknown as jest.Mock).mock?.calls ?? [];

      expect(JSON.stringify(calls)).not.toContain(managerPin);
      expect(JSON.stringify(calls)).not.toContain(internalApiToken);
    }
  }

  async function openSessionWithSale(
    stage: 'OPEN' | 'PAID' | 'COMPLETED'
  ): Promise<{ sessionId: string; saleId: string }> {
    await productPriceUpdatedConsumer.handle(
      createProductPriceUpdatedEvent({
        productId: '4be1e5d2-93d0-44fe-a2b8-0dc560889b9b',
        tenantId,
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        previousUnitPrice: 8.5,
        active: true
      })
    );

    const openSessionResponse = await http()
      .post('/pos-sessions')
      .send({
        tenantId,
        registerId: 'register-01',
        operatorId: '4d8e5af5-1d49-4a55-8ce9-b95959cf63ee',
        openingFloatAmount: 200
      })
      .expect(HttpStatus.CREATED);
    const sessionId = openSessionResponse.body.sessionId as string;

    const startSaleResponse = await http()
      .post('/sales')
      .send({ tenantId, sessionId })
      .expect(HttpStatus.CREATED);
    const saleId = startSaleResponse.body.saleId as string;

    await http()
      .post(`/sales/${saleId}/items`)
      .send({ tenantId, barcode: '7891000000200', quantity: 2 })
      .expect(HttpStatus.OK);

    if (stage === 'OPEN') {
      return { sessionId, saleId };
    }

    await http()
      .post(`/sales/${saleId}/payment`)
      .send({ tenantId, paymentMethod: SalePaymentMethod.Cash, paidAmount: 20 })
      .expect(HttpStatus.OK);

    if (stage === 'COMPLETED') {
      await http().post(`/sales/${saleId}/completion`).send({ tenantId }).expect(HttpStatus.OK);
    }

    return { sessionId, saleId };
  }

  function cancel(saleId: string, body: Record<string, unknown> = {}) {
    return http()
      .post(`/sales/${saleId}/cancellation`)
      .set('x-correlation-id', 'e2e-cancel-correlation')
      .send({
        tenantId,
        reason: 'Customer requested reversal after price mismatch',
        managerApproval: { employeeCode: 'manager-01', pin: managerPin },
        ...body
      });
  }

  async function persistedSale(saleId: string): Promise<SaleTypeormEntity> {
    return dataSource.getRepository(SaleTypeormEntity).findOneByOrFail({ id: saleId });
  }

  async function expectSaleUnchanged(saleId: string, status: string): Promise<void> {
    const sale = await persistedSale(saleId);

    expect(sale.status).toBe(status);
    expect(sale.canceledAt).toBeNull();
    expect(sale.cancellationReason).toBeNull();
    expect(sale.cancellationApprovedByEmployeeId).toBeNull();
    expect(
      (await dataSource.getRepository(OutboxEventTypeormEntity).find()).filter(
        (event) => event.eventName === 'SaleCanceled'
      )
    ).toHaveLength(0);
  }

  it('cancels a completed sale approved by management and closes the register session with durable events', async () => {
    managementStub.respondWith(respondJson(200, { outcome: 'APPROVED', approver }));

    const { sessionId, saleId } = await openSessionWithSale('COMPLETED');

    const cancelResponse = await cancel(saleId).expect(HttpStatus.OK);

    expect(cancelResponse.body).toMatchObject({
      status: 'CANCELED',
      cancellationReason: 'Customer requested reversal after price mismatch',
      cancellationApprovedBy: approver,
      eventPublicationStatus: 'published'
    });
    expect(JSON.stringify(cancelResponse.body)).not.toContain(managerPin);
    expect(managementStub.requests).toHaveLength(1);
    expect(managementStub.requests[0]).toMatchObject({
      method: 'POST',
      url: '/internal/manager-approvals/verifications',
      headers: {
        authorization: `Bearer ${internalApiToken}`,
        'content-type': 'application/json',
        'x-correlation-id': 'e2e-cancel-correlation'
      },
      body: {
        tenantId,
        approverCode: 'manager-01',
        pin: managerPin,
        registerId: 'register-01',
        saleId
      }
    });

    const closeResponse = await http()
      .post(`/pos-sessions/${sessionId}/closure`)
      .send({ tenantId, declaredCashAmount: 220.2 })
      .expect(HttpStatus.OK);

    expect(closeResponse.body).toMatchObject({
      status: 'CLOSED',
      declaredCashAmount: 220.2,
      eventPublicationStatus: 'published'
    });

    const sale = await persistedSale(saleId);
    const persistedSession = await dataSource
      .getRepository(PosSessionTypeormEntity)
      .findOneByOrFail({ id: sessionId });
    const persistedOutboxEvents = await dataSource.getRepository(OutboxEventTypeormEntity).find();
    const saleCanceledEvent = persistedOutboxEvents.find(
      (event) => event.eventName === 'SaleCanceled'
    );

    expect(sale.status).toBe('CANCELED');
    expect(sale.cancellationReason).toBe('Customer requested reversal after price mismatch');
    expect(sale).toMatchObject({
      cancellationApprovedByEmployeeId: approver.employeeId,
      cancellationApprovedByEmployeeCode: approver.employeeCode,
      cancellationApprovedByFullName: approver.fullName
    });
    expect(saleCanceledEvent?.payload).toMatchObject({
      previousStatus: 'COMPLETED',
      approvedByEmployeeId: approver.employeeId,
      approvedByEmployeeCode: approver.employeeCode
    });
    expect(JSON.stringify(persistedOutboxEvents)).not.toContain(managerPin);
    expect(persistedSession.status).toBe('CLOSED');
    expect(persistedSession.declaredCashAmount).toBe(220.2);
    expect(persistedOutboxEvents).toHaveLength(3);
    expect(fakePublisher.publish).toHaveBeenCalledTimes(3);
  });

  it('answers 403 when management denies the approval and keeps the sale', async () => {
    managementStub.respondWith(respondJson(200, { outcome: 'DENIED', approver: null }));

    const { saleId } = await openSessionWithSale('PAID');

    const response = await cancel(saleId).expect(HttpStatus.FORBIDDEN);

    expect(response.body).toMatchObject({
      statusCode: 403,
      code: 'AUTHORIZATION_DENIED',
      message: 'Manager approval was rejected'
    });
    expect(JSON.stringify(response.body)).not.toContain(managerPin);
    expect(managementStub.requests).toHaveLength(1);
    await expectSaleUnchanged(saleId, 'PAID');
  });

  it('answers 429 when management reports a lockout and keeps the sale', async () => {
    managementStub.respondWith(respondJson(200, { outcome: 'LOCKED', approver: null }));

    const { saleId } = await openSessionWithSale('COMPLETED');

    const response = await cancel(saleId).expect(HttpStatus.TOO_MANY_REQUESTS);

    expect(response.body).toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_ATTEMPTS',
      message: 'Manager approval is temporarily locked'
    });
    await expectSaleUnchanged(saleId, 'COMPLETED');
  });

  it.each([
    [
      'delays beyond the 200 ms timeout',
      respondJson(200, { outcome: 'APPROVED', approver }, 1000),
      'timeout'
    ],
    ['returns 500', respondJson(500, { message: 'boom' }), 'status 500'],
    [
      'returns 401',
      respondJson(401, { statusCode: 401, message: 'Unauthorized' }),
      'status 401 (check MANAGEMENT_INTERNAL_API_TOKEN)'
    ],
    [
      'returns a body without the approver field',
      respondJson(200, { outcome: 'DENIED' }),
      'invalid response'
    ]
  ])('answers 503 when management %s, once and without retry', async (_label, responder, reason) => {
    managementStub.respondWith(responder);

    if (reason === 'timeout') {
      verifier.useShortTimeout();
    }

    const { saleId } = await openSessionWithSale('COMPLETED');

    const response = await cancel(saleId).expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(response.body).toMatchObject({
      statusCode: 503,
      code: 'DEPENDENCY_UNAVAILABLE',
      message: 'Manager approval is unavailable; the sale was not canceled'
    });
    expect(managementStub.requests).toHaveLength(1);
    expect(logger.error).toHaveBeenCalledWith(`Manager approval verification failed: ${reason}`);
    await expectSaleUnchanged(saleId, 'COMPLETED');
  });

  it('answers 409 for a paid sale without approval and does not call management', async () => {
    const { saleId } = await openSessionWithSale('PAID');

    const response = await cancel(saleId, { managerApproval: undefined }).expect(
      HttpStatus.CONFLICT
    );

    expect(response.body.message).toBe(
      `Sale ${saleId} requires manager approval before cancellation after payment`
    );
    expect(managementStub.requests).toHaveLength(0);
    await expectSaleUnchanged(saleId, 'PAID');
  });

  it('rejects the removed free-text managerApprovalCode with 400', async () => {
    const { saleId } = await openSessionWithSale('PAID');

    const response = await cancel(saleId, {
      managerApproval: undefined,
      managerApprovalCode: 'MGR-42'
    }).expect(HttpStatus.BAD_REQUEST);

    expect(response.body).toMatchObject({ statusCode: 400 });
    expect(managementStub.requests).toHaveLength(0);
    await expectSaleUnchanged(saleId, 'PAID');
  });

  it.each([
    ['a 3-digit PIN', { employeeCode: 'MANAGER-01', pin: '123' }],
    ['a non-numeric PIN', { employeeCode: 'MANAGER-01', pin: '12a4' }],
    ['a 13-digit PIN', { employeeCode: 'MANAGER-01', pin: '1234567890123' }],
    ['a numeric PIN', { employeeCode: 'MANAGER-01', pin: 2468 }],
    ['a one-character code', { employeeCode: ' M ', pin: '2468' }],
    ['a 33-character code', { employeeCode: 'M'.repeat(33), pin: '2468' }],
    ['an unknown field', { employeeCode: 'MANAGER-01', pin: '2468', role: 'ADMIN' }],
    ['a string instead of an object', 'MANAGER-01:2468']
  ])('rejects %s with 400 without calling management', async (_label, managerApproval) => {
    const { saleId } = await openSessionWithSale('PAID');

    const response = await cancel(saleId, { managerApproval }).expect(HttpStatus.BAD_REQUEST);

    expect(JSON.stringify(response.body)).not.toContain('2468');
    expect(managementStub.requests).toHaveLength(0);
  });

  it('cancels an open sale without approval and never calls management', async () => {
    const { saleId } = await openSessionWithSale('OPEN');

    const response = await cancel(saleId, { managerApproval: undefined }).expect(HttpStatus.OK);

    expect(response.body).toMatchObject({
      status: 'CANCELED',
      cancellationApprovedBy: null
    });
    expect(managementStub.requests).toHaveLength(0);
  });

  it('ignores an approval sent for an open sale', async () => {
    const { saleId } = await openSessionWithSale('OPEN');

    const response = await cancel(saleId).expect(HttpStatus.OK);

    expect(response.body.cancellationApprovedBy).toBeNull();
    expect(managementStub.requests).toHaveLength(0);
  });

  it('exposes cancellationApprovedBy as null on regular sale responses', async () => {
    const { saleId } = await openSessionWithSale('PAID');
    const response = await http()
      .post(`/sales/${saleId}/completion`)
      .send({ tenantId })
      .expect(HttpStatus.OK);

    expect(response.body).toHaveProperty('cancellationApprovedBy', null);
  });

  // Keep last: it stops the stub server for good.
  it('answers 503 when the management port is closed', async () => {
    const { saleId } = await openSessionWithSale('COMPLETED');

    await managementStub.stop();

    const response = await cancel(saleId).expect(HttpStatus.SERVICE_UNAVAILABLE);

    expect(response.body).toMatchObject({ code: 'DEPENDENCY_UNAVAILABLE' });
    expect(logger.error).toHaveBeenCalledWith('Manager approval verification failed: network');
    await expectSaleUnchanged(saleId, 'COMPLETED');
  });
});
