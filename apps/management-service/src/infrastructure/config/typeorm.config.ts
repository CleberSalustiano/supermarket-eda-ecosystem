import { join } from 'path';

import { DataSource } from 'typeorm';
import type { DataSourceOptions } from 'typeorm';

import { managementServiceEnvironment } from './management-service.environment';

export const managementServiceDataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: managementServiceEnvironment.database.host,
  port: managementServiceEnvironment.database.port,
  username: managementServiceEnvironment.database.user,
  password: managementServiceEnvironment.database.password,
  database: managementServiceEnvironment.database.name,
  ssl: managementServiceEnvironment.database.ssl ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging:
    managementServiceEnvironment.nodeEnvironment === 'development'
      ? ['error', 'warn']
      : ['error'],
  entities: [join(__dirname, '../../**/*.typeorm-entity.{js,ts}')],
  migrations: [join(__dirname, '../../migrations/*.{js,ts}')],
  migrationsTableName: 'management_service_migrations'
};

export const managementServiceDataSource = new DataSource(managementServiceDataSourceOptions);
