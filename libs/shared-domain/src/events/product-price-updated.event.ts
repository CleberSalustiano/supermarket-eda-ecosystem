import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const PRODUCT_PRICE_UPDATED_EVENT_NAME = 'ProductPriceUpdated';

export interface ProductPriceUpdatedEventPayload extends TenantScoped {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  previousUnitPrice: number;
  active: boolean;
}

export function createProductPriceUpdatedEvent(
  payload: ProductPriceUpdatedEventPayload
): EventEnvelope<ProductPriceUpdatedEventPayload> {
  return createEventEnvelope({
    eventName: PRODUCT_PRICE_UPDATED_EVENT_NAME,
    topic: KafkaTopics.management.productPriceUpdated,
    aggregateId: payload.productId,
    payload
  });
}
