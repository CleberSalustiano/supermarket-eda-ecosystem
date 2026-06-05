import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { checkoutServiceEnvironment } from './checkout-service.environment';

export const checkoutServiceDataSourceOptions: DataSourceOptions = {
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
  entities: [join(__dirname, '../../**/*.typeorm-entity.{js,ts}')],
  migrations: [join(__dirname, '../../migrations/*.{js,ts}')],
  migrationsTableName: 'checkout_service_migrations'
};

export const checkoutServiceDataSource = new DataSource(checkoutServiceDataSourceOptions);
