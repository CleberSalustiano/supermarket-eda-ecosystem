import type { TenantScoped } from '../identifiers/tenant-scoped.interface';
import { InventoryLossReason } from '../enums/inventory-loss-reason.enum';
import { createEventEnvelope, type EventEnvelope } from './event-envelope';
import { KafkaTopics } from './kafka-topics';

export const INVENTORY_LOSS_REGISTERED_EVENT_NAME = 'InventoryLossRegistered';

export interface InventoryLossRegisteredEventPayload extends TenantScoped {
  lossId: string;
  stockMovementId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes: string | null;
  onHandQuantityAfterLoss: number;
  recordedAt: string;
}

export function createInventoryLossRegisteredEvent(
  payload: InventoryLossRegisteredEventPayload
): EventEnvelope<InventoryLossRegisteredEventPayload> {
  return createEventEnvelope({
    eventName: INVENTORY_LOSS_REGISTERED_EVENT_NAME,
    topic: KafkaTopics.inventory.inventoryLossRegistered,
    aggregateId: payload.lossId,
    payload
  });
}
