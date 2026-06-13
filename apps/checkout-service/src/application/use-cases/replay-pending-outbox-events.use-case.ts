import { Inject, Injectable } from '@nestjs/common';

import type { ReplayPendingOutboxEventsOutputDto } from '../dto/replay-pending-outbox-events.dto';
import type { OutboxEventRelayPort } from '../ports/outbox-event-relay.port';
import { OUTBOX_EVENT_RELAY } from '../ports/outbox-event-relay.port';
import type { OutboxEventRepositoryPort } from '../ports/outbox-event-repository.port';
import { OUTBOX_EVENT_REPOSITORY } from '../ports/outbox-event-repository.port';
import {
  OUTBOX_REPLAY_OPTIONS,
  type OutboxReplayOptions
} from '../ports/outbox-replay.options';

@Injectable()
export class ReplayPendingOutboxEventsUseCase {
  constructor(
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxEventRepository: OutboxEventRepositoryPort,
    @Inject(OUTBOX_EVENT_RELAY)
    private readonly outboxEventRelay: OutboxEventRelayPort,
    @Inject(OUTBOX_REPLAY_OPTIONS)
    private readonly outboxReplayOptions: OutboxReplayOptions
  ) {}

  async execute(): Promise<ReplayPendingOutboxEventsOutputDto> {
    const pendingEvents = await this.outboxEventRepository.findPendingBatch(
      this.outboxReplayOptions.batchSize
    );
    let publishedEvents = 0;
    let stillPendingEvents = 0;
    const processedEventIds: string[] = [];

    for (const event of pendingEvents) {
      processedEventIds.push(event.eventId);
      const status = await this.outboxEventRelay.dispatch(event.eventId);

      if (status === 'published') {
        publishedEvents += 1;
      } else {
        stillPendingEvents += 1;
      }
    }

    return {
      scannedEvents: pendingEvents.length,
      publishedEvents,
      stillPendingEvents,
      processedEventIds
    };
  }
}
