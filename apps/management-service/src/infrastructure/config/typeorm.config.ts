import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { managementTypeormEntities } from '../persistence/typeorm/entities/management-typeorm-entities';
import { managementServiceEnvironment } from './management-service.environment';

export function createManagementDataSourceOptions(
  overrides: Partial<DataSourceOptions> = {}
): DataSourceOptions {
  return {
    type: 'postgres',
    host: managementServiceEnvironment.database.host,
    port: managementServiceEnvironment.database.port,
    username: managementServiceEnvironment.database.user,
    password: managementServiceEnvironment.database.password,
    database: managementServiceEnvironment.database.name,
    ssl: managementServiceEnvironment.database.ssl ? { rejectUnauthorized: false } : false,
    synchronize: false,
    logging:
      managementServiceEnvironment.nodeEnvironment === 'development' ? ['error', 'warn'] : ['error'],
    entities: [...managementTypeormEntities],
    migrations: [join(__dirname, '../../../migrations/*.{js,ts}')],
    migrationsTableName: 'management_service_migrations',
    ...overrides
  } as DataSourceOptions;
}

export const managementServiceDataSourceOptions = createManagementDataSourceOptions();

export const managementServiceDataSource = new DataSource(managementServiceDataSourceOptions);
