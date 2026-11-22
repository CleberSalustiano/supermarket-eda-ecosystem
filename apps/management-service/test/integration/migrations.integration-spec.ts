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

  it('leaves no schema drift against the entities', async () => {
    const schemaLog = await dataSource.driver.createSchemaBuilder().log();

    expect(schemaLog.upQueries.map((query) => query.query)).toEqual([]);
  });
});
