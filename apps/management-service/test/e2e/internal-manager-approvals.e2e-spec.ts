import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { ValidationPipe } from '@nestjs/common';

import request from 'supertest';
import { DataSource } from 'typeorm';

import { MANAGER_APPROVAL_VERIFICATION_PATH } from '@supermarket/shared-domain';
import {
  AppLoggerService,
  CorrelationIdInterceptor,
  DEFAULT_CORS_EXCLUDED_PATH_PREFIXES,
  GlobalHttpExceptionFilter,
  INTERNAL_API_TOKENS,
  InternalApiTokenGuard,
  SERVICE_ENVIRONMENT,
  createCorsOptionsDelegate
} from '@supermarket/shared-infra';

import { CREDENTIAL_HASHER } from '#/application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from '#/application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { MANAGER_APPROVAL_OPTIONS } from '#/application/ports/manager-approval.options';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { DeactivateEmployeeUseCase } from '#/application/use-cases/deactivate-employee.use-case';
import { ListEmployeesUseCase } from '#/application/use-cases/list-employees.use-case';
import { RegisterEmployeeUseCase } from '#/application/use-cases/register-employee.use-case';
import { VerifyManagerApprovalUseCase } from '#/application/use-cases/verify-manager-approval.use-case';
import { createManagerApprovalOptions } from '#/infrastructure/config/manager-approval.options';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { ApprovalThrottleTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/approval-throttle.typeorm-entity';
import { EmployeeAuditEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee-audit-entry.typeorm-entity';
import { EmployeeTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee.typeorm-entity';
import { ManagerApprovalAttemptTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/manager-approval-attempt.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from '#/infrastructure/security/scrypt-credential-hasher.service';
import { EmployeesController } from '#/interfaces/http/employees.controller';
import { InternalManagerApprovalsController } from '#/interfaces/http/internal-manager-approvals.controller';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';

const TENANT_A = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const TENANT_B = '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0';
const SALE_ID = 'b1f0b5a4-1c2d-4e3f-8a9b-0c1d2e3f4a5b';
const REGISTER = 'register-01';
const INTERNAL_TOKEN = 'e2e-internal-token-0123456789abcdef';
const ROTATED_TOKEN = 'e2e-rotated-token-fedcba9876543210';
const MANAGER_PIN = '246813';
const WRONG_PIN = '975310';
const NEW_PIN = '864297';
const ALLOWED_ORIGIN = 'http://localhost:4100';

describe('management-service internal manager approval verification', () => {
  let application: INestApplication;
  let dataSource: DataSource;
  let logLines: string[];
  const writeSpies: jest.SpyInstance[] = [];

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [EmployeesController, InternalManagerApprovalsController],
      providers: [
        AppLoggerService,
        ChangeEmployeePinUseCase,
        DeactivateEmployeeUseCase,
        InternalApiTokenGuard,
        ListEmployeesUseCase,
        RegisterEmployeeUseCase,
        ReliableOutboxEventRelayService,
        ScryptCredentialHasherService,
        TypeormManagementTransactionRunner,
        TypeormOutboxEventRepository,
        VerifyManagerApprovalUseCase,
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
        { provide: DataSource, useValue: dataSource },
        { provide: INTERNAL_API_TOKENS, useValue: [INTERNAL_TOKEN, ROTATED_TOKEN] },
        { provide: MANAGER_APPROVAL_OPTIONS, useValue: createManagerApprovalOptions({}) },
        { provide: CREDENTIAL_HASHER, useExisting: ScryptCredentialHasherService },
        { provide: MANAGEMENT_EVENT_PUBLISHER, useValue: { publish: jest.fn(async () => undefined) } },
        { provide: MANAGEMENT_TRANSACTION_RUNNER, useExisting: TypeormManagementTransactionRunner },
        { provide: OUTBOX_EVENT_RELAY, useExisting: ReliableOutboxEventRelayService },
        { provide: OUTBOX_EVENT_REPOSITORY, useExisting: TypeormOutboxEventRepository }
      ]
    }).compile();

    application = moduleFixture.createNestApplication();
    application.useLogger(application.get(AppLoggerService));
    application.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false }
      })
    );
    application.useGlobalInterceptors(new CorrelationIdInterceptor());
    application.useGlobalFilters(new GlobalHttpExceptionFilter(application.get(AppLoggerService)));
    application.enableCors(
      createCorsOptionsDelegate([ALLOWED_ORIGIN], DEFAULT_CORS_EXCLUDED_PATH_PREFIXES)
    );

    await application.init();

    const logger = application.get(AppLoggerService);

    for (const method of ['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const) {
      jest.spyOn(logger, method).mockImplementation((...args: unknown[]) => {
        logLines.push(JSON.stringify(args));
      });
    }

    for (const stream of [process.stdout, process.stderr]) {
      const original = stream.write.bind(stream);

      writeSpies.push(
        jest.spyOn(stream, 'write').mockImplementation(((chunk: unknown, ...rest: unknown[]) => {
          logLines.push(String(chunk));

          return (original as (...args: unknown[]) => boolean)(chunk, ...rest);
        }) as typeof stream.write)
      );
    }
  });

  beforeEach(() => {
    logLines = [];
  });

  afterEach(async () => {
    // No response and no log line may ever contain a PIN.
    for (const pin of [MANAGER_PIN, WRONG_PIN, NEW_PIN]) {
      expect(logLines.join('\n')).not.toContain(pin);
    }

    for (const entity of [
      ManagerApprovalAttemptTypeormEntity,
      ApprovalThrottleTypeormEntity,
      EmployeeAuditEntryTypeormEntity,
      OutboxEventTypeormEntity,
      EmployeeTypeormEntity
    ]) {
      await dataSource.getRepository(entity).clear();
    }
  });

  afterAll(async () => {
    for (const spy of writeSpies) {
      spy.mockRestore();
    }

    await application?.close();

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  const api = () => request(application.getHttpAdapter().getInstance());

  async function register(
    tenantId: string,
    employeeCode: string,
    role = 'MANAGER',
    pin = MANAGER_PIN
  ): Promise<string> {
    const response = await api()
      .post('/employees')
      .send({ tenantId, employeeCode, fullName: `Employee ${employeeCode}`, role, pin })
      .expect(201);

    return response.body.employeeId as string;
  }

  async function verify(
    // Loosely typed so invalid bodies (unknown fields) can be sent too.
    overrides: Record<string, string> = {},
    token = INTERNAL_TOKEN
  ) {
    const response = await api()
      .post(MANAGER_APPROVAL_VERIFICATION_PATH)
      .set('Authorization', `Bearer ${token}`)
      .send({
        tenantId: TENANT_A,
        approverCode: 'mg-01',
        pin: MANAGER_PIN,
        registerId: REGISTER,
        saleId: SALE_ID,
        ...overrides
      });

    for (const pin of [MANAGER_PIN, WRONG_PIN, NEW_PIN]) {
      expect(response.text).not.toContain(pin);
    }

    return response;
  }

  async function attemptRows() {
    return dataSource.getRepository(ManagerApprovalAttemptTypeormEntity).find({
      order: { attemptedAt: 'ASC' }
    });
  }

  describe('authentication', () => {
    const validBody = {
      tenantId: TENANT_A,
      approverCode: 'mg-01',
      pin: MANAGER_PIN,
      registerId: REGISTER,
      saleId: SALE_ID
    };

    it('answers 401 without a token, with a wrong token or with the wrong scheme', async () => {
      await register(TENANT_A, 'mg-01');

      for (const authorization of [
        undefined,
        'Bearer wrong-token-0123456789abcdef0123',
        `Basic ${INTERNAL_TOKEN}`,
        INTERNAL_TOKEN
      ]) {
        const call = api().post(MANAGER_APPROVAL_VERIFICATION_PATH).send(validBody);
        const response = await (authorization ? call.set('Authorization', authorization) : call);

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ statusCode: 401, message: 'Unauthorized' });
      }

      expect(await attemptRows()).toHaveLength(0);
      // The spies do capture the guard's warnings, so the PIN/token checks are not vacuous.
      expect(logLines.join('\n')).toContain(
        `Rejected internal API call to POST ${MANAGER_APPROVAL_VERIFICATION_PATH}`
      );
      expect(logLines.join('\n')).not.toContain(INTERNAL_TOKEN);
    });

    it('accepts every configured token for rotation', async () => {
      await register(TENANT_A, 'mg-01');

      expect((await verify({}, ROTATED_TOKEN)).body.outcome).toBe('APPROVED');
    });
  });

  it('answers 400 for an invalid body without naming any value', async () => {
    await api()
      .post(MANAGER_APPROVAL_VERIFICATION_PATH)
      .set('Authorization', `Bearer ${INTERNAL_TOKEN}`)
      .send({})
      .expect(400);

    for (const body of <Array<Record<string, string>>>[
      { tenantId: 'nope' },
      { approverCode: 'x' },
      { approverCode: 'x'.repeat(33) },
      { pin: '12' },
      { pin: '12ab' },
      { registerId: '' },
      { registerId: 'r'.repeat(65) },
      { saleId: 'not-a-uuid' },
      { extra: 'field' }
    ]) {
      const response = await verify(body);

      expect(response.status).toBe(400);
    }

    expect(await attemptRows()).toHaveLength(0);
  });

  it('approves an active manager with 200 and the approver', async () => {
    const employeeId = await register(TENANT_A, 'mg-01');

    const response = await verify();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      outcome: 'APPROVED',
      approver: { employeeId, employeeCode: 'MG-01', fullName: 'Employee mg-01' }
    });
    expect(await attemptRows()).toEqual([
      expect.objectContaining({
        tenantId: TENANT_A,
        approverCode: 'MG-01',
        employeeId,
        registerId: REGISTER,
        saleId: SALE_ID,
        outcome: 'APPROVED',
        reason: null
      })
    ]);
  });

  it('approves an admin and denies a cashier with the same 200 status', async () => {
    await register(TENANT_A, 'ad-01', 'ADMIN');
    await register(TENANT_A, 'cx-01', 'CASHIER');

    expect((await verify({ approverCode: 'AD-01' })).body.outcome).toBe('APPROVED');

    const denied = await verify({ approverCode: 'cx-01' });

    expect(denied.status).toBe(200);
    expect(denied.body).toEqual({ outcome: 'DENIED', approver: null });
  });

  it('denies a wrong PIN and an unknown code with approver null', async () => {
    await register(TENANT_A, 'mg-01');

    for (const response of [
      await verify({ pin: WRONG_PIN }),
      await verify({ approverCode: 'nobody' })
    ]) {
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ outcome: 'DENIED', approver: null });
      expect(Object.keys(response.body).sort()).toEqual(['approver', 'outcome']);
    }

    expect((await attemptRows()).map((row) => row.reason).sort()).toEqual([
      'UNKNOWN_CODE',
      'WRONG_PIN'
    ]);
  });

  it('locks a code after 5 failures, even for the correct PIN', async () => {
    await register(TENANT_A, 'mg-01');

    for (let failure = 0; failure < 5; failure += 1) {
      expect((await verify({ pin: WRONG_PIN })).body.outcome).toBe('DENIED');
    }

    const locked = await verify();

    expect(locked.status).toBe(200);
    expect(locked.body).toEqual({ outcome: 'LOCKED', approver: null });
  });

  it('locks a register after 10 failures across codes, even for a valid manager', async () => {
    await register(TENANT_A, 'mg-01');

    for (let failure = 0; failure < 10; failure += 1) {
      expect((await verify({ approverCode: `unknown-${failure}` })).body.outcome).toBe('DENIED');
    }

    expect((await verify()).body).toEqual({ outcome: 'LOCKED', approver: null });
    expect((await verify({ registerId: 'register-02' })).body.outcome).toBe('APPROVED');
  });

  it('denies a deactivated manager immediately', async () => {
    const employeeId = await register(TENANT_A, 'mg-01');

    expect((await verify()).body.outcome).toBe('APPROVED');

    await api()
      .post(`/employees/${employeeId}/deactivation`)
      .send({ tenantId: TENANT_A })
      .expect(200);

    expect((await verify()).body).toEqual({ outcome: 'DENIED', approver: null });
  });

  it('after a PIN change denies the old PIN, approves the new one and unlocks the code', async () => {
    const employeeId = await register(TENANT_A, 'mg-01');

    for (let failure = 0; failure < 5; failure += 1) {
      await verify({ pin: WRONG_PIN });
    }

    expect((await verify()).body.outcome).toBe('LOCKED');

    await api()
      .put(`/employees/${employeeId}/pin`)
      .send({ tenantId: TENANT_A, pin: NEW_PIN })
      .expect(200);

    expect((await verify()).body.outcome).toBe('DENIED');
    expect((await verify({ pin: NEW_PIN })).body.outcome).toBe('APPROVED');
  });

  it('isolates tenants for employees and lockouts', async () => {
    await register(TENANT_A, 'mg-01');
    await register(TENANT_B, 'mg-01', 'MANAGER', NEW_PIN);

    expect((await verify({ tenantId: TENANT_B })).body.outcome).toBe('DENIED');

    for (let failure = 0; failure < 4; failure += 1) {
      await verify({ tenantId: TENANT_B, pin: WRONG_PIN });
    }

    expect((await verify({ tenantId: TENANT_B, pin: NEW_PIN })).body.outcome).toBe('LOCKED');
    expect((await verify()).body.outcome).toBe('APPROVED');
  });

  it('sends no CORS headers on an internal preflight from an allowed browser origin', async () => {
    const preflight = await api()
      .options(MANAGER_APPROVAL_VERIFICATION_PATH)
      .set('Origin', ALLOWED_ORIGIN)
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type');

    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
    expect(preflight.headers['access-control-allow-headers']).toBeUndefined();

    const publicCall = await api()
      .get('/employees')
      .query({ tenantId: TENANT_A })
      .set('Origin', ALLOWED_ORIGIN);

    expect(publicCall.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
  });
});
