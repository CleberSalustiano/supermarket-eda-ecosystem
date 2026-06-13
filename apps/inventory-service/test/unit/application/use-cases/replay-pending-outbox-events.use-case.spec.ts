import { createEventEnvelope } from '@supermarket/shared-domain';

import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryOutboxEventRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('ReplayPendingOutboxEventsUseCase', () => {
  it('replays the oldest pending inventory outbox events within the configured batch size', async () => {
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new ReplayPendingOutboxEventsUseCase(
      outboxEventRepository,
      outboxEventRelay,
      {
        intervalMs: 30000,
        batchSize: 2
      }
    );

    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: 'feb59f8d-d633-4f67-a35a-68783d336c2f',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: 'c9df7908-663a-40cf-9981-09aad06420da',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: 'd1a505cd-2419-43da-a6b9-f7f0ff8ee366',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: 'c1cb4776-c28e-4ff0-b9ec-d4e06b7fa7c7',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: 'd175d90c-1987-4545-b746-0438ca7bb84f',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: '6ae05786-b104-4eca-aa63-0a4da70665f0',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );

    const result = await useCase.execute();

    expect(result).toMatchObject({
      scannedEvents: 2,
      publishedEvents: 2,
      stillPendingEvents: 0
    });
    expect(result.processedEventIds).toEqual([
      'feb59f8d-d633-4f67-a35a-68783d336c2f',
      'd1a505cd-2419-43da-a6b9-f7f0ff8ee366'
    ]);
    expect(outboxEventRelay.dispatchedEventIds).toEqual(result.processedEventIds);
  });

  it('keeps pending inventory outbox events pending when the relay still fails', async () => {
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const outboxEventRelay = new FakeOutboxEventRelay('pending');
    const useCase = new ReplayPendingOutboxEventsUseCase(
      outboxEventRepository,
      outboxEventRelay,
      {
        intervalMs: 30000,
        batchSize: 10
      }
    );

    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: '43f73ffc-9bcf-4e5d-8ba0-bb232ca1e0b0',
        eventName: 'InventoryOutboxReplayRequested',
        topic: 'inventory.outbox.replay.requested',
        aggregateId: 'ae7c38cb-82b2-41be-b487-4485b8919b5d',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7'
        }
      })
    );

    const result = await useCase.execute();

    expect(result).toMatchObject({
      scannedEvents: 1,
      publishedEvents: 0,
      stillPendingEvents: 1
    });
    expect(outboxEventRelay.dispatchedEventIds).toEqual(['43f73ffc-9bcf-4e5d-8ba0-bb232ca1e0b0']);
  });
});
