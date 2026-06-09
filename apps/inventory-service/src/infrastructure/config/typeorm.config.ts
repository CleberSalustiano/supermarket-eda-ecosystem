import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { inventoryTypeormEntities } from '../persistence/typeorm/entities/inventory-typeorm-entities';
import { inventoryServiceEnvironment } from './inventory-service.environment';

export function createInventoryDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {}
): DataSourceOptions {
  return {
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
    entities: [...inventoryTypeormEntities],
    migrations: [join(__dirname, '../../../migrations/*.{js,ts}')],
    migrationsTableName: 'inventory_service_migrations',
    ...overrides
  } as DataSourceOptions;
}

export const inventoryServiceDataSourceOptions = createInventoryDataSourceOptions();

export const inventoryServiceDataSource = new DataSource(inventoryServiceDataSourceOptions);
