import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { checkoutServiceMigrations } from '../../migrations';
import { createCheckoutDataSourceOptions } from '#/infrastructure/config/typeorm.config';

describe('checkout-service migrations integration', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'checkout_service',
        POSTGRES_USER: 'checkout_user',
        POSTGRES_PASSWORD: 'checkout_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createCheckoutDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'checkout_user',
        password: 'checkout_password',
        database: 'checkout_service',
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

    expect(executed).toHaveLength(checkoutServiceMigrations.length);
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
