import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';

import { managementTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/management-typeorm-entities';

export async function createManagementPgMemoryDataSource(): Promise<DataSource> {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });

  database.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem_management'
  });
  database.public.registerFunction({
    name: 'version',
    implementation: () => 'pg-mem'
  });
  database.public.registerFunction({
    name: 'quote_ident',
    args: ['text'],
    implementation: (value: string) => value
  });
  database.public.registerFunction({
    name: 'obj_description',
    args: ['regclass', 'text'],
    implementation: () => null
  });
  database.public.registerFunction({
    name: 'current_schema',
    implementation: () => 'public'
  });

  const dataSource = await database.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: [...managementTypeormEntities],
    synchronize: true,
    logging: false
  });

  await dataSource.initialize();

  return dataSource;
}
