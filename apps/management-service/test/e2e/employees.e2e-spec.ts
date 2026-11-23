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

import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { DeactivateEmployeeUseCase } from '#/application/use-cases/deactivate-employee.use-case';
import { ListEmployeesUseCase } from '#/application/use-cases/list-employees.use-case';
import { RegisterEmployeeUseCase } from '#/application/use-cases/register-employee.use-case';
import { CREDENTIAL_HASHER } from '#/application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from '#/application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '#/application/ports/management-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from '#/application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';
import { ReliableOutboxEventRelayService } from '#/infrastructure/events/reliable-outbox-event-relay.service';
import { EmployeeAuditEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee-audit-entry.typeorm-entity';
import { EmployeeTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee.typeorm-entity';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from '#/infrastructure/security/scrypt-credential-hasher.service';
import { EmployeesController } from '#/interfaces/http/employees.controller';
import { createManagementPgMemoryDataSource } from '../support/create-management-pg-memory-data-source';

const TENANT_A = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const TENANT_B = '4601c7f8-5388-42d6-ad7f-cf1a5c9ec6b0';

describe('management-service employees flow', () => {
  let application: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createManagementPgMemoryDataSource();

    const moduleFixture = await Test.createTestingModule({
      controllers: [EmployeesController],
      providers: [
        AppLoggerService,
        ChangeEmployeePinUseCase,
        DeactivateEmployeeUseCase,
        ListEmployeesUseCase,
        RegisterEmployeeUseCase,
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
        { provide: DataSource, useValue: dataSource },
        { provide: CREDENTIAL_HASHER, useExisting: ScryptCredentialHasherService },
        { provide: MANAGEMENT_EVENT_PUBLISHER, useValue: { publish: jest.fn(async () => undefined) } },
        { provide: MANAGEMENT_TRANSACTION_RUNNER, useExisting: TypeormManagementTransactionRunner },
        { provide: OUTBOX_EVENT_RELAY, useExisting: ReliableOutboxEventRelayService },
        { provide: OUTBOX_EVENT_REPOSITORY, useExisting: TypeormOutboxEventRepository }
      ]
    }).compile();

    application = moduleFixture.createNestApplication();
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

    await application.init();
  });

  afterEach(async () => {
    await dataSource.getRepository(EmployeeAuditEntryTypeormEntity).clear();
    await dataSource.getRepository(OutboxEventTypeormEntity).clear();
    await dataSource.getRepository(EmployeeTypeormEntity).clear();
  });

  afterAll(async () => {
    await application?.close();

    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }
  });

  async function register(
    tenantId: string,
    employeeCode: string,
    pin = '123456',
    role = 'MANAGER'
  ): Promise<string> {
    const response = await request(application.getHttpAdapter().getInstance())
      .post('/employees')
      .send({ tenantId, employeeCode, fullName: `Employee ${employeeCode}`, role, pin })
      .expect(201);

    return response.body.employeeId as string;
  }

  const api = () => request(application.getHttpAdapter().getInstance());

  it('lists employees by status with pagination, total and code ordering', async () => {
    await register(TENANT_A, 'c-03');
    await register(TENANT_A, 'c-01');
    const inactiveId = await register(TENANT_A, 'c-02');

    await api()
      .post(`/employees/${inactiveId}/deactivation`)
      .send({ tenantId: TENANT_A })
      .expect(200);

    const all = await api().get('/employees').query({ tenantId: TENANT_A }).expect(200);

    expect(all.body).toMatchObject({ total: 3, limit: 50, offset: 0 });
    expect(all.body.items.map((item: { employeeCode: string }) => item.employeeCode)).toEqual([
      'C-01',
      'C-02',
      'C-03'
    ]);

    const active = await api()
      .get('/employees')
      .query({ tenantId: TENANT_A, status: 'active' })
      .expect(200);
    const inactive = await api()
      .get('/employees')
      .query({ tenantId: TENANT_A, status: 'inactive' })
      .expect(200);

    expect(active.body.total).toBe(2);
    expect(inactive.body.items).toEqual([
      expect.objectContaining({ employeeCode: 'C-02', active: false })
    ]);
    expect(inactive.body.items[0].deactivatedAt).toEqual(expect.any(String));

    const page = await api()
      .get('/employees')
      .query({ tenantId: TENANT_A, limit: 1, offset: 1 })
      .expect(200);

    expect(page.body).toMatchObject({ total: 3, limit: 1, offset: 1 });
    expect(page.body.items).toHaveLength(1);
    expect(page.body.items[0].employeeCode).toBe('C-02');
  });

  it('rejects invalid list queries', async () => {
    await api().get('/employees').expect(400);
    await api().get('/employees').query({ tenantId: 'nope' }).expect(400);
    await api().get('/employees').query({ tenantId: TENANT_A, status: 'weird' }).expect(400);
    await api().get('/employees').query({ tenantId: TENANT_A, limit: 0 }).expect(400);
    await api().get('/employees').query({ tenantId: TENANT_A, limit: 201 }).expect(400);
    await api().get('/employees').query({ tenantId: TENANT_A, offset: -1 }).expect(400);
  });

  it('isolates tenants on list and on deactivation', async () => {
    const employeeId = await register(TENANT_A, 'mg-01');

    await register(TENANT_B, 'mg-01');

    const listB = await api().get('/employees').query({ tenantId: TENANT_B }).expect(200);

    expect(listB.body.total).toBe(1);
    expect(listB.body.items[0].employeeId).not.toBe(employeeId);

    await api()
      .post(`/employees/${employeeId}/deactivation`)
      .send({ tenantId: TENANT_B })
      .expect(404);
    await api()
      .put(`/employees/${employeeId}/pin`)
      .send({ tenantId: TENANT_B, pin: '654321' })
      .expect(404);
  });

  it('deactivates once, then conflicts, and records the audit trail', async () => {
    const employeeId = await register(TENANT_A, 'mg-01');

    const first = await api()
      .post(`/employees/${employeeId}/deactivation`)
      .send({ tenantId: TENANT_A })
      .expect(200);

    expect(first.body).toMatchObject({ employeeId, active: false, employeeCode: 'MG-01' });
    expect(first.body.deactivatedAt).toEqual(expect.any(String));

    await api()
      .post(`/employees/${employeeId}/deactivation`)
      .send({ tenantId: TENANT_A })
      .expect(409);
    await api()
      .post(`/employees/${employeeId}/deactivation`)
      .send({ tenantId: TENANT_A })
      .expect(409);

    const audit = await dataSource.getRepository(EmployeeAuditEntryTypeormEntity).find();

    expect(audit.map((entry) => entry.action).sort()).toEqual(['DEACTIVATED', 'REGISTERED']);
  });

  it('validates the deactivation request', async () => {
    await api().post('/employees/not-a-uuid/deactivation').send({ tenantId: TENANT_A }).expect(400);
    await api()
      .post('/employees/11111111-1111-4111-8111-111111111111/deactivation')
      .send({})
      .expect(400);
    await api()
      .post('/employees/11111111-1111-4111-8111-111111111111/deactivation')
      .send({ tenantId: TENANT_A })
      .expect(404);
  });

  it('changes the PIN and stores a new hash', async () => {
    const employeeId = await register(TENANT_A, 'mg-01', '123456');
    const before = await dataSource.getRepository(EmployeeTypeormEntity).findOneByOrFail({ id: employeeId });

    const response = await api()
      .put(`/employees/${employeeId}/pin`)
      .send({ tenantId: TENANT_A, pin: '654321' })
      .expect(200);

    expect(response.body).toMatchObject({ employeeId, tenantId: TENANT_A, employeeCode: 'MG-01' });
    expect(response.body.pinChangedAt).toEqual(expect.any(String));

    const after = await dataSource.getRepository(EmployeeTypeormEntity).findOneByOrFail({ id: employeeId });
    const hasher = new ScryptCredentialHasherService();

    expect(after.pinHash).not.toBe(before.pinHash);
    await expect(hasher.verify('654321', after.pinHash)).resolves.toBe(true);
    await expect(hasher.verify('123456', after.pinHash)).resolves.toBe(false);

    const audit = await dataSource.getRepository(EmployeeAuditEntryTypeormEntity).find();

    expect(audit.map((entry) => entry.action).sort()).toEqual(['PIN_CHANGED', 'REGISTERED']);
  });

  it('rejects the same PIN, a badly formatted PIN, and an inactive employee', async () => {
    const employeeId = await register(TENANT_A, 'mg-01', '123456');

    await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '123456' }).expect(400);
    await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '12ab' }).expect(400);
    await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '123' }).expect(400);
    await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A }).expect(400);

    await api().post(`/employees/${employeeId}/deactivation`).send({ tenantId: TENANT_A }).expect(200);
    await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '654321' }).expect(409);
  });

  it('never exposes PIN data in any response body', async () => {
    const employeeId = await register(TENANT_A, 'mg-01', '123456');
    const stored = await dataSource.getRepository(EmployeeTypeormEntity).findOneByOrFail({ id: employeeId });
    const responses = [
      await api().get('/employees').query({ tenantId: TENANT_A }),
      await api().post(`/employees/${employeeId}/deactivation`).send({ tenantId: TENANT_A }),
      await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '654321' }),
      await api().put(`/employees/${employeeId}/pin`).send({ tenantId: TENANT_A, pin: '12' })
    ];

    for (const response of responses) {
      const serialized = JSON.stringify(response.body);

      expect(serialized).not.toMatch(/pinHash/i);
      expect(serialized).not.toContain(stored.pinHash);
      expect(serialized).not.toContain('654321');
    }
  });
});
