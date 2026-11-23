import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { managementServiceMigrations } from '../../migrations';
import { createManagementDataSourceOptions } from '#/infrastructure/config/typeorm.config';

describe('management-service migrations integration', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;

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
        migrationsRun: false,
        logging: false
      })
    );
    await dataSource.initialize();
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }

    if (container !== undefined) {
      await container.stop();
    }
  }, 120000);

  it('applies every registered migration on an empty database', async () => {
    const executed = await dataSource.runMigrations();

    expect(executed).toHaveLength(managementServiceMigrations.length);
  });

  it('executes no migration on a second run', async () => {
    const executed = await dataSource.runMigrations();

    expect(executed).toHaveLength(0);
  });

  it('creates the employee deactivation column and the audit table', async () => {
    const [column] = (await dataSource.query(
      `SELECT is_nullable, data_type FROM information_schema.columns
       WHERE table_name = 'employees' AND column_name = 'deactivatedAt'`
    )) as Array<{ is_nullable: string; data_type: string }>;
    const auditColumns = (await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'employee_audit_entries' ORDER BY column_name`
    )) as Array<{ column_name: string }>;

    expect(column).toEqual({ is_nullable: 'YES', data_type: 'timestamp with time zone' });
    expect(auditColumns.map((row) => row.column_name)).toEqual([
      'action',
      'employeeCode',
      'employeeId',
      'id',
      'occurredAt',
      'tenantId'
    ]);
  });

  it('creates the manager approval throttle and attempt tables with their keys', async () => {
    const throttleColumns = (await dataSource.query(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_name = 'manager_approval_throttles' ORDER BY column_name`
    )) as Array<{ column_name: string; is_nullable: string }>;
    const throttlePrimaryKey = (await dataSource.query(
      `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = 'manager_approval_throttles'::regclass AND i.indisprimary
       ORDER BY a.attname`
    )) as Array<{ column_name: string }>;
    const attemptColumns = (await dataSource.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name = 'manager_approval_attempts' ORDER BY column_name`
    )) as Array<{ column_name: string }>;
    const attemptIndexes = (await dataSource.query(
      `SELECT indexname FROM pg_indexes
       WHERE tablename = 'manager_approval_attempts' AND indexname LIKE 'idx_%' ORDER BY indexname`
    )) as Array<{ indexname: string }>;

    expect(throttleColumns).toEqual([
      { column_name: 'createdAt', is_nullable: 'NO' },
      { column_name: 'failureCount', is_nullable: 'NO' },
      { column_name: 'lockedUntil', is_nullable: 'YES' },
      { column_name: 'scope', is_nullable: 'NO' },
      { column_name: 'subject', is_nullable: 'NO' },
      { column_name: 'tenantId', is_nullable: 'NO' },
      { column_name: 'updatedAt', is_nullable: 'NO' },
      { column_name: 'windowStartedAt', is_nullable: 'YES' }
    ]);
    expect(throttlePrimaryKey.map((row) => row.column_name)).toEqual([
      'scope',
      'subject',
      'tenantId'
    ]);
    expect(attemptColumns.map((row) => row.column_name)).toEqual([
      'approverCode',
      'attemptedAt',
      'employeeId',
      'id',
      'outcome',
      'reason',
      'registerId',
      'saleId',
      'tenantId'
    ]);
    expect(attemptIndexes.map((row) => row.indexname)).toEqual([
      'idx_manager_approval_attempts_tenant_code_time',
      'idx_manager_approval_attempts_tenant_register_time'
    ]);
  });

  it('leaves no schema drift against the entities', async () => {
    const schemaLog = await dataSource.driver.createSchemaBuilder().log();

    expect(schemaLog.upQueries.map((query) => query.query)).toEqual([]);
  });
});
