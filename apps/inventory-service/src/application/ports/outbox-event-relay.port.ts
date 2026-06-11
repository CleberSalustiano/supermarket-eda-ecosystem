import type { IntegrationEventPublicationStatus } from '#/application/dto/integration-event-publication-status';

export const OUTBOX_EVENT_RELAY = Symbol('OUTBOX_EVENT_RELAY');

export interface OutboxEventRelayPort {
  dispatch(eventId: string): Promise<IntegrationEventPublicationStatus>;
}
