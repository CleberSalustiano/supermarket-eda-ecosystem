import { randomUUID } from 'crypto';

import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { EmployeeRole } from '@supermarket/shared-domain';

import { ChangeEmployeePinUseCase } from '#/application/use-cases/change-employee-pin.use-case';
import { VerifyManagerApprovalUseCase } from '#/application/use-cases/verify-manager-approval.use-case';
import { Employee } from '#/domain/entities/employee.entity';
import { createManagerApprovalOptions } from '#/infrastructure/config/manager-approval.options';
import { createManagementDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { ApprovalThrottleTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/approval-throttle.typeorm-entity';
import { EmployeeAuditEntryTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee-audit-entry.typeorm-entity';
import { EmployeeTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/employee.typeorm-entity';
import { ManagerApprovalAttemptTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/manager-approval-attempt.typeorm-entity';
import { TypeormEmployeeRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-employee.repository';
import { TypeormManagementTransactionRunner } from '#/infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from '#/infrastructure/security/scrypt-credential-hasher.service';

const TENANT = '8ea5ea2d-d2ef-40af-a673-d67d2fe30262';
const MANAGER_ID = '11111111-1111-4111-8111-111111111111';
const MANAGER_PIN = '246813';
const WRONG_PIN = '975310';

describe('management-service manager approval verification integration (PostgreSQL)', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;
  let hasher: ScryptCredentialHasherService;
  let useCase: VerifyManagerApprovalUseCase;
  let runner: TypeormManagementTransactionRunner;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'management_service',
        POSTGRES_USER: 'management_user',
        POSTGRES_PASSWORD: 'management_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createManagementDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'management_user',
        password: 'management_password',
        database: 'management_service',
        migrationsRun: true,
        logging: false,
        // More connections than parallel attempts, so every attempt really
        // contends on the throttle row locks instead of on the pool.
        extra: { max: 20 }
      } as Parameters<typeof createManagementDataSourceOptions>[0])
    );
    await dataSource.initialize();

    hasher = new ScryptCredentialHasherService();
    runner = new TypeormManagementTransactionRunner(dataSource);
    useCase = new VerifyManagerApprovalUseCase(hasher, runner, createManagerApprovalOptions({}));
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }

    if (container !== undefined) {
      await container.stop();
    }
  }, 120000);

  beforeEach(async () => {
    await new TypeormEmployeeRepository(dataSource).save(
      Employee.register({
        id: MANAGER_ID,
        tenantId: TENANT,
        employeeCode: 'mg-01',
        fullName: 'John Manager',
        role: EmployeeRole.Manager,
        pinHash: await hasher.hash(MANAGER_PIN)
      })
    );
  });

  afterEach(async () => {
    for (const entity of [
      ManagerApprovalAttemptTypeormEntity,
      ApprovalThrottleTypeormEntity,
      EmployeeAuditEntryTypeormEntity,
      EmployeeTypeormEntity
    ]) {
      await dataSource.getRepository(entity).clear();
    }
  });

  const verify = (approverCode: string, pin: string, registerId: string) =>
    useCase.execute({ tenantId: TENANT, approverCode, pin, registerId, saleId: randomUUID() });

  async function outcomeCounts(): Promise<Record<string, number>> {
    const rows = await dataSource.getRepository(ManagerApprovalAttemptTypeormEntity).find();

    return rows.reduce<Record<string, number>>((counts, row) => {
      const key = `${row.outcome}:${row.reason ?? '-'}`;

      counts[key] = (counts[key] ?? 0) + 1;

      return counts;
    }, {});
  }

  it('approves, denies and audits against PostgreSQL without storing the PIN', async () => {
    expect((await verify('mg-01', MANAGER_PIN, 'register-01')).outcome).toBe('APPROVED');
    expect((await verify('mg-01', WRONG_PIN, 'register-01')).outcome).toBe('DENIED');
    expect((await verify('nobody', MANAGER_PIN, 'register-01')).outcome).toBe('DENIED');

    expect(await outcomeCounts()).toEqual({
      'APPROVED:-': 1,
      'DENIED:WRONG_PIN': 1,
      'DENIED:UNKNOWN_CODE': 1
    });

    const rawAttempts = JSON.stringify(
      await dataSource.query('SELECT * FROM manager_approval_attempts')
    );
    const rawThrottles = JSON.stringify(
      await dataSource.query('SELECT * FROM manager_approval_throttles')
    );

    expect(rawAttempts + rawThrottles).not.toMatch(new RegExp(`${MANAGER_PIN}|${WRONG_PIN}`));
  });

  it('never exceeds the code limit under 8 parallel wrong attempts (max 5)', async () => {
    const results = await Promise.all(
      Array.from({ length: 8 }, () => verify('mg-01', WRONG_PIN, 'register-01'))
    );

    expect(results.filter((result) => result.outcome === 'DENIED')).toHaveLength(5);
    expect(results.filter((result) => result.outcome === 'LOCKED')).toHaveLength(3);
    expect(await outcomeCounts()).toEqual({ 'DENIED:WRONG_PIN': 5, 'LOCKED:CODE_LOCKED': 3 });

    const codeThrottle = await dataSource
      .getRepository(ApprovalThrottleTypeormEntity)
      .findOneByOrFail({ tenantId: TENANT, scope: 'APPROVER_CODE', subject: 'MG-01' });

    expect(codeThrottle.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect(codeThrottle.failureCount).toBe(0);
    // The lock holds even for the correct PIN.
    expect((await verify('mg-01', MANAGER_PIN, 'register-02')).outcome).toBe('LOCKED');
  }, 60000);

  it('never exceeds the register limit under 12 parallel unknown codes (max 10)', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        verify(`unknown-${index}`, WRONG_PIN, 'register-01')
      )
    );

    expect(results.filter((result) => result.outcome === 'DENIED')).toHaveLength(10);
    expect(results.filter((result) => result.outcome === 'LOCKED')).toHaveLength(2);
    expect(await outcomeCounts()).toEqual({
      'DENIED:UNKNOWN_CODE': 10,
      'LOCKED:REGISTER_LOCKED': 2
    });

    const registerThrottle = await dataSource
      .getRepository(ApprovalThrottleTypeormEntity)
      .findOneByOrFail({ tenantId: TENANT, scope: 'REGISTER', subject: 'register-01' });

    expect(registerThrottle.lockedUntil?.getTime()).toBeGreaterThan(Date.now());
    expect((await verify('mg-01', MANAGER_PIN, 'register-01')).outcome).toBe('LOCKED');
  }, 60000);

  it('clears the code lock in PostgreSQL when the PIN changes', async () => {
    for (let failure = 0; failure < 5; failure += 1) {
      await verify('mg-01', WRONG_PIN, 'register-01');
    }

    expect((await verify('mg-01', MANAGER_PIN, 'register-02')).outcome).toBe('LOCKED');

    await new ChangeEmployeePinUseCase(hasher, runner).execute({
      tenantId: TENANT,
      employeeId: MANAGER_ID,
      pin: '13572468'
    });

    expect((await verify('mg-01', '13572468', 'register-02')).outcome).toBe('APPROVED');
  }, 60000);
});
