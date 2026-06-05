import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { inventoryServiceEnvironment } from './inventory-service.environment';

export const inventoryServiceDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: inventoryServiceEnvironment.database.host,
  port: inventoryServiceEnvironment.database.port,
  username: inventoryServiceEnvironment.database.user,
  password: inventoryServiceEnvironment.database.password,
  database: inventoryServiceEnvironment.database.name,
  ssl: inventoryServiceEnvironment.database.ssl ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging:
    inventoryServiceEnvironment.nodeEnvironment === 'development' ? ['error', 'warn'] : ['error'],
  entities: [join(__dirname, '../../**/*.typeorm-entity.{js,ts}')],
  migrations: [join(__dirname, '../../migrations/*.{js,ts}')],
  migrationsTableName: 'inventory_service_migrations'
};

export const inventoryServiceDataSource = new DataSource(inventoryServiceDataSourceOptions);
