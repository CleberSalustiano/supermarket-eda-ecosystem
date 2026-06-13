import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const PRODUCT_RECEIVED_EVENT_NAME = 'ProductReceived';

export interface ProductReceivedEventItemPayload {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
  onHandQuantityAfterReceipt: number;
  averageUnitCostAfterReceipt: number;
}

export interface ProductReceivedEventPayload extends TenantScoped {
  invoiceId: string;
  supplierReference: string;
  receivedAt: string;
  totalItemsQuantity: number;
  totalCost: number;
  items: ProductReceivedEventItemPayload[];
}

export function createProductReceivedEvent(
  payload: ProductReceivedEventPayload
): EventEnvelope<ProductReceivedEventPayload> {
  return createEventEnvelope({
    eventName: PRODUCT_RECEIVED_EVENT_NAME,
    topic: KafkaTopics.inventory.productReceived,
    aggregateId: payload.invoiceId,
    payload
  });
}
