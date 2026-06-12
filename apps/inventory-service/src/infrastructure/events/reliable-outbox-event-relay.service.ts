import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';
import { AppLoggerService } from '@supermarket/shared-infra';

import type { IntegrationEventPublicationStatus } from '#/application/dto/integration-event-publication-status';
import type { InventoryEventPublisherPort } from '#/application/ports/inventory-event-publisher.port';
import { INVENTORY_EVENT_PUBLISHER } from '#/application/ports/inventory-event-publisher.port';
import type { OutboxEventRelayPort } from '#/application/ports/outbox-event-relay.port';
import type { OutboxEventRepositoryPort } from '#/application/ports/outbox-event-repository.port';
import { OUTBOX_EVENT_REPOSITORY } from '#/application/ports/outbox-event-repository.port';

@Injectable()
export class ReliableOutboxEventRelayService implements OutboxEventRelayPort {
  constructor(
    private readonly logger: AppLoggerService,
    @Inject(INVENTORY_EVENT_PUBLISHER)
    private readonly inventoryEventPublisher: InventoryEventPublisherPort,
    @Inject(OUTBOX_EVENT_REPOSITORY)
    private readonly outboxEventRepository: OutboxEventRepositoryPort
  ) {}

  async dispatch(eventId: string): Promise<IntegrationEventPublicationStatus> {
    const event = await this.outboxEventRepository.findById(eventId);

    if (!event) {
      throw new ResourceNotFoundError(`Outbox event ${eventId} was not found`);
    }

    if (event.publishedAt) {
      return 'published';
    }

    try {
      await this.inventoryEventPublisher.publish(event);
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
