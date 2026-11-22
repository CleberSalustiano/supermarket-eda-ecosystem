import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { checkoutServiceMigrations } from '../../../migrations';
import { checkoutTypeormEntities } from '../persistence/typeorm/entities/checkout-typeorm-entities';
import { checkoutServiceEnvironment } from './checkout-service.environment';

export function createCheckoutDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {}
): DataSourceOptions {
  return {
    type: 'postgres',
    host: checkoutServiceEnvironment.database.host,
    port: checkoutServiceEnvironment.database.port,
    username: checkoutServiceEnvironment.database.user,
    password: checkoutServiceEnvironment.database.password,
    database: checkoutServiceEnvironment.database.name,
    ssl: checkoutServiceEnvironment.database.ssl ? { rejectUnauthorized: false } : false,
    synchronize: false,
    logging:
      checkoutServiceEnvironment.nodeEnvironment === 'development' ? ['error', 'warn'] : ['error'],
    entities: [...checkoutTypeormEntities],
    migrations: [...checkoutServiceMigrations],
    migrationsRun: checkoutServiceEnvironment.database.migrationsRun,
    migrationsTableName: 'checkout_service_migrations',
    ...overrides
  } as DataSourceOptions;
}

export const checkoutServiceDataSourceOptions = createCheckoutDataSourceOptions();

export const checkoutServiceDataSource = new DataSource(checkoutServiceDataSourceOptions);
