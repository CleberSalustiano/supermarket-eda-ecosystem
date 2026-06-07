import { newDb } from 'pg-mem';
import { DataSource } from 'typeorm';

import { createCheckoutDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { checkoutTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/checkout-typeorm-entities';

export async function createCheckoutPgMemoryDataSource(): Promise<DataSource> {
  const database = newDb({
    autoCreateForeignKeyIndices: true
  });

  database.public.registerFunction({
    name: 'current_database',
    implementation: () => 'pg_mem_checkout'
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
    createCheckoutDataSourceOptions({
      type: 'postgres',
      entities: [...checkoutTypeormEntities],
      synchronize: true,
      logging: false
    })
  );

  await dataSource.initialize();

  return dataSource;
}
