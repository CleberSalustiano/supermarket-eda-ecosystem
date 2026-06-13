import { createEventEnvelope } from '@supermarket/shared-domain';

import { ReplayPendingOutboxEventsUseCase } from '#/application/use-cases/replay-pending-outbox-events.use-case';
import {
  FakeOutboxEventRelay,
  InMemoryOutboxEventRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('ReplayPendingOutboxEventsUseCase', () => {
  it('replays the oldest pending outbox events within the configured batch size', async () => {
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
        eventId: '9f0ca5d2-1962-4252-88ff-1cf2f400d0f1',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: 'a12315ba-0105-4416-b8b4-17cad6f4be18',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: '6ba85022-cb27-49a5-b9f8-0e6efb31de01',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: '5986cc55-dfe0-40e3-ae5c-c4068dcb1d5d',
        occurredAt: '2026-06-13T12:01:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );
    await outboxEventRepository.save(
      createEventEnvelope({
        eventId: '153c9bca-51f6-4707-b4b1-63f085668d76',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: 'a590d4cf-07a7-461c-b55d-d70382893ab6',
        occurredAt: '2026-06-13T12:02:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
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
      '9f0ca5d2-1962-4252-88ff-1cf2f400d0f1',
      '6ba85022-cb27-49a5-b9f8-0e6efb31de01'
    ]);
    expect(outboxEventRelay.dispatchedEventIds).toEqual(result.processedEventIds);
  });

  it('keeps pending events pending when the relay cannot publish them yet', async () => {
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
        eventId: '543b2baa-6485-4214-98e4-3f674752f96d',
        eventName: 'CheckoutOutboxReplayRequested',
        topic: 'checkout.outbox.replay.requested',
        aggregateId: 'ce7d24e6-060e-4c99-bef7-41367c2cb848',
        occurredAt: '2026-06-13T12:00:00.000Z',
        payload: {
          tenantId: '3470d47b-0701-4c53-9976-46bd59900fd5'
        }
      })
    );

    const result = await useCase.execute();

    expect(result).toMatchObject({
      scannedEvents: 1,
      publishedEvents: 0,
      stillPendingEvents: 1
    });
    expect(outboxEventRelay.dispatchedEventIds).toEqual(['543b2baa-6485-4214-98e4-3f674752f96d']);
  });
});
