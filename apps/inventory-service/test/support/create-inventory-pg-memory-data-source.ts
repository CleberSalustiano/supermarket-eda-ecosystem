import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';

import { createInventoryDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { inventoryTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/inventory-typeorm-entities';

export async function createInventoryPgMemoryDataSource(): Promise<DataSource> {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });

  database.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem_inventory'
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

  const dataSource = await database.adapters.createTypeormDataSource(
    createInventoryDataSourceOptions({
      type: 'postgres',
      entities: [...inventoryTypeormEntities],
      synchronize: true,
      logging: false
    })
  );

  await dataSource.initialize();

  return dataSource;
}
