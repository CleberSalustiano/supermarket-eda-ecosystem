import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { createEventEnvelope } from '@supermarket/shared-domain';

import { createInventoryDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { inventoryTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/inventory-typeorm-entities';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';

describe('inventory-service outbox repository integration', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;
  let repository: TypeormOutboxEventRepository;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'inventory_service',
        POSTGRES_USER: 'inventory_user',
        POSTGRES_PASSWORD: 'inventory_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createInventoryDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'inventory_user',
        password: 'inventory_password',
        database: 'inventory_service',
        entities: [...inventoryTypeormEntities],
        migrations: [],
        synchronize: true,
        logging: false
      })
    );
    await dataSource.initialize();
    repository = new TypeormOutboxEventRepository(dataSource);
  }, 120000);

  afterAll(async () => {
    if (dataSource?.isInitialized === true) {
      await dataSource.destroy();
    }

    if (container !== undefined) {
      await container.stop();
    }
  }, 120000);

  afterEach(async () => {
    if (dataSource?.isInitialized === true) {
      await dataSource.getRepository(OutboxEventTypeormEntity).clear();
    }
  });

  it('loads the oldest unpublished inventory events in batch order and excludes published records', async () => {
    await repository.save(
      createEventEnvelope({
        eventId: '4f79c450-a982-46d2-91d2-f49a6a8241e6',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: '1bad453b-c4cb-47c1-9e70-9831be1fbc8d',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: 'f7ec884d-8698-43dd-b4f9-dd7dbcf31cc9',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: 'a981b621-1111-470a-9183-3a2f4e2299c7',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: 'c95fa5a1-cfe5-4f8c-81c2-196b4ca25ca7',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: '23cff134-acd6-44af-aecf-2d9b3c9ff660',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );

    await repository.markPublished('f7ec884d-8698-43dd-b4f9-dd7dbcf31cc9', new Date());

    const pendingEvents = await repository.findPendingBatch(5);

    expect(pendingEvents.map((event) => event.eventId)).toEqual([
      '4f79c450-a982-46d2-91d2-f49a6a8241e6',
      'c95fa5a1-cfe5-4f8c-81c2-196b4ca25ca7'
    ]);
  });
});
