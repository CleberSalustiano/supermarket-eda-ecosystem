import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

export const INVENTORY_EVENT_PUBLISHER = Symbol('INVENTORY_EVENT_PUBLISHER');

export interface InventoryEventPublisherPort {
  publish<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void>;
}
