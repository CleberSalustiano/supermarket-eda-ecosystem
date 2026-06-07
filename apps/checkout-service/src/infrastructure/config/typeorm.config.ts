import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

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
    migrations: [join(__dirname, '../../../migrations/*.{js,ts}')],
    migrationsTableName: 'checkout_service_migrations',
    ...overrides
  } as DataSourceOptions;
}

export const checkoutServiceDataSourceOptions = createCheckoutDataSourceOptions();

export const checkoutServiceDataSource = new DataSource(checkoutServiceDataSourceOptions);
