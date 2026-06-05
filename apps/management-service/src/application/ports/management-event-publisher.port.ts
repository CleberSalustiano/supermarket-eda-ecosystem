import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

export const MANAGEMENT_EVENT_PUBLISHER = Symbol('MANAGEMENT_EVENT_PUBLISHER');

export interface ManagementEventPublisherPort {
  publish<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void>;
}
