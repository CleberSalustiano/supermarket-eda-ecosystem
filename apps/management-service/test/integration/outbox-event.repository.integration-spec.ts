import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { createEventEnvelope } from '@supermarket/shared-domain';

import { createManagementDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { managementTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/management-typeorm-entities';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';

describe('management-service outbox repository integration', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;
  let repository: TypeormOutboxEventRepository;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'management_service',
        POSTGRES_USER: 'management_user',
        POSTGRES_PASSWORD: 'management_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createManagementDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'management_user',
        password: 'management_password',
        database: 'management_service',
        entities: [...managementTypeormEntities],
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

  it('loads the oldest unpublished management events in batch order and excludes published records', async () => {
    await repository.save(
      createEventEnvelope({
        eventId: 'd2c8a7e3-06ec-4b99-a1c8-8a8f2e141918',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: 'ca6b40f7-b237-4762-a59f-a6ec9bf71060',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: 'be29d967-03c1-4d49-91b2-84e59f459386',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: '36aa959c-f1f0-4fd8-85ce-3e410f0290d6',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: 'f4fdc74e-b6fc-4cbe-a4ca-cceb0b4d47c1',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: '1c3ca909-82df-4f02-abf8-7f29be3368b4',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );

    await repository.markPublished('be29d967-03c1-4d49-91b2-84e59f459386', new Date());

    const pendingEvents = await repository.findPendingBatch(5);

    expect(pendingEvents.map((event) => event.eventId)).toEqual([
      'd2c8a7e3-06ec-4b99-a1c8-8a8f2e141918',
      'f4fdc74e-b6fc-4cbe-a4ca-cceb0b4d47c1'
    ]);
  });
});
