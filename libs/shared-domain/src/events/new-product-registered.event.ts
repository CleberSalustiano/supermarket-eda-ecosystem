import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const NEW_PRODUCT_REGISTERED_EVENT_NAME = 'NewProductRegistered';

export interface NewProductRegisteredEventPayload extends TenantScoped {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
}

export function createNewProductRegisteredEvent(
  payload: NewProductRegisteredEventPayload
): EventEnvelope<NewProductRegisteredEventPayload> {
  return createEventEnvelope({
    eventName: NEW_PRODUCT_REGISTERED_EVENT_NAME,
    topic: KafkaTopics.management.productRegistered,
    aggregateId: payload.productId,
    payload
  });
}
