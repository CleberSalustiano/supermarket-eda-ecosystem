import { DataSource } from 'typeorm';

import { GenericContainer, Wait } from 'testcontainers';

import { createEventEnvelope } from '@supermarket/shared-domain';

import { createCheckoutDataSourceOptions } from '#/infrastructure/config/typeorm.config';
import { checkoutTypeormEntities } from '#/infrastructure/persistence/typeorm/entities/checkout-typeorm-entities';
import { OutboxEventTypeormEntity } from '#/infrastructure/persistence/typeorm/entities/outbox-event.typeorm-entity';
import { TypeormOutboxEventRepository } from '#/infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';

describe('checkout-service outbox repository integration', () => {
  let container: Awaited<ReturnType<GenericContainer['start']>>;
  let dataSource: DataSource;
  let repository: TypeormOutboxEventRepository;

  beforeAll(async () => {
    container = await new GenericContainer('postgres:16-alpine')
      .withEnvironment({
        POSTGRES_DB: 'checkout_service',
        POSTGRES_USER: 'checkout_user',
        POSTGRES_PASSWORD: 'checkout_password'
      })
      .withExposedPorts(5432)
      .withWaitStrategy(Wait.forLogMessage('database system is ready to accept connections', 2))
      .start();

    dataSource = new DataSource(
      createCheckoutDataSourceOptions({
        host: container.getHost(),
        port: container.getMappedPort(5432),
        username: 'checkout_user',
        password: 'checkout_password',
        database: 'checkout_service',
        entities: [...checkoutTypeormEntities],
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

  it('loads the oldest unpublished checkout events in batch order and excludes published records', async () => {
    await repository.save(
      createEventEnvelope({
        eventId: 'd85f5c43-b84c-4df5-8b73-df14d1d8902b',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: '82584b6b-f9e2-42cd-84ea-c65d69e4267e',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: '671f092f-f642-47fb-9fce-49825d44ec38',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: '9009a278-94b2-499b-a5b1-7e99311c7b2d',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );
    await repository.save(
      createEventEnvelope({
        eventId: 'cc4f6a62-8c91-445f-b0d2-1ceefb1189f5',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: 'b636504d-f7a8-4cd7-b933-27cc83219b5c',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );

    await repository.markPublished('671f092f-f642-47fb-9fce-49825d44ec38', new Date());

    const pendingEvents = await repository.findPendingBatch(5);

    expect(pendingEvents.map((event) => event.eventId)).toEqual([
      'd85f5c43-b84c-4df5-8b73-df14d1d8902b',
      'cc4f6a62-8c91-445f-b0d2-1ceefb1189f5'
    ]);
  });
});
