import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

export const CHECKOUT_EVENT_PUBLISHER = Symbol('CHECKOUT_EVENT_PUBLISHER');

export interface CheckoutEventPublisherPort {
  publish<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void>;
}
