import type {
  EventEnvelope,
  InventoryLossRegisteredEventPayload
} from '@supermarket/shared-domain';

export interface CaptureInventoryLossInputDto {
  event: EventEnvelope<InventoryLossRegisteredEventPayload>;
}

export interface CaptureInventoryLossOutputDto {
  lossId: string;
  tenantId: string;
  businessDate: string;
  processingStatus: 'processed' | 'ignored';
  inventoryLossEntryId: string | null;
}
