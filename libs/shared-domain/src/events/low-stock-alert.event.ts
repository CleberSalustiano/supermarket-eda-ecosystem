import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const LOW_STOCK_ALERT_EVENT_NAME = 'LowStockAlert';

export interface LowStockAlertEventItemPayload {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  onHandQuantity: number;
  minimumThreshold: number;
  averageUnitCost: number | null;
}

export interface LowStockAlertEventPayload extends TenantScoped {
  alertId: string;
  emittedAt: string;
  items: LowStockAlertEventItemPayload[];
}

export function createLowStockAlertEvent(
  payload: LowStockAlertEventPayload
): EventEnvelope<LowStockAlertEventPayload> {
  return createEventEnvelope({
    eventName: LOW_STOCK_ALERT_EVENT_NAME,
    topic: KafkaTopics.inventory.lowStockAlert,
    aggregateId: payload.alertId,
    payload
  });
}
