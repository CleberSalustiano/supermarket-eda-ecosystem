import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';
import { AppLoggerService } from '@supermarket/shared-infra';

import type { ManagementEventPublisherPort } from '../../application/ports/management-event-publisher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from '../../application/ports/management-event-publisher.port';
import type { OutboxEventRelayPort } from '../../application/ports/outbox-event-relay.port';
import type { OutboxEventRepositoryPort } from '../../application/ports/outbox-event-repository.port';
import { OUTBOX_EVENT_REPOSITORY } from '../../application/ports/outbox-event-repository.port';
import type { IntegrationEventPublicationStatus } from '../../application/dto/integration-event-publication-status';

@Injectable()
export class ReliableOutboxEventRelayService implements OutboxEventRelayPort {
  constructor(
    private readonly logger: AppLoggerService,
    @Inject(MANAGEMENT_EVENT_PUBLISHER)
    private readonly managementEventPublisher: ManagementEventPublisherPort,
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxEventRepository: OutboxEventRepositoryPort
  ) {}

  async dispatch(eventId: string): Promise<IntegrationEventPublicationStatus> {
    const event = await this.outboxEventRepository.findById(eventId);

    if (event === null) {
      throw new ResourceNotFoundError(`Outbox event ${eventId} was not found`);
    }

    if (event.publishedAt !== null) {
      return 'published';
    }

    try {
      await this.managementEventPublisher.publish(event);
      await this.outboxEventRepository.markPublished(eventId, new Date());
      this.logger.log(`Published integration event ${event.eventName} (${event.eventId})`);

      return 'published';
    } catch (error: unknown) {
      const failureReason =
        error instanceof Error ? error.message : 'Unknown error while publishing integration event';

      await this.outboxEventRepository.registerFailure(eventId, failureReason);
      this.logger.error(
        `Failed to publish integration event ${event.eventName} (${event.eventId}): ${failureReason}`,
        error instanceof Error ? error.stack : undefined
      );

      return 'pending';
    }
  }
}
