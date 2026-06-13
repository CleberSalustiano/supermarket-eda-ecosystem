import { createEventEnvelope } from '@supermarket/shared-domain';

import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryOutboxEventRepository
} from '../../../support/in-memory-management-test-doubles';

describe('ReplayPendingOutboxEventsUseCase', () => {
  it('replays the oldest pending management outbox events within the configured batch size', async () => {
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
        eventId: 'bb45b04d-2789-4355-ad36-19a28e12c4a7',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: '7fd57e77-d95f-43a9-948c-26e2b21de0fd',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: 'f82215cc-8cdd-4d9d-9bc3-91f391735034',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: 'e9c308a1-2618-43b7-b6d3-0f6f2d49c6c8',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: '70f7a086-144f-4580-bf83-4a54e7143328',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: '231067d7-6393-4589-85cb-0df9fe900ba8',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
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
      'bb45b04d-2789-4355-ad36-19a28e12c4a7',
      'f82215cc-8cdd-4d9d-9bc3-91f391735034'
    ]);
    expect(outboxEventRelay.dispatchedEventIds).toEqual(result.processedEventIds);
  });

  it('keeps pending management outbox events pending when the relay still fails', async () => {
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
        eventId: '05cb8f4c-a4d7-47ca-b9bb-0fd0a20b7df5',
        eventName: 'ManagementOutboxReplayRequested',
        topic: 'management.outbox.replay.requested',
        aggregateId: '5ca9c5a0-4c92-478b-b8f1-e66c1b43c405',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '4d73874c-36a5-421a-8853-a55747947b6e'
        }
      })
    );

    const result = await useCase.execute();

    expect(result).toMatchObject({
      scannedEvents: 1,
      publishedEvents: 0,
      stillPendingEvents: 1
    });
    expect(outboxEventRelay.dispatchedEventIds).toEqual(['05cb8f4c-a4d7-47ca-b9bb-0fd0a20b7df5']);
  });
});
