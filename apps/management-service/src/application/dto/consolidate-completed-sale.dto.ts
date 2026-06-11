import type {
  EventEnvelope,
  SaleCompletedEventPayload
} from '@supermarket/shared-domain';

export interface ConsolidateCompletedSaleInputDto {
  event: EventEnvelope<SaleCompletedEventPayload>;
}

export interface ConsolidateCompletedSaleOutputDto {
  saleId: string;
  tenantId: string;
  businessDate: string;
  processingStatus: 'processed' | 'ignored' | 'skipped';
  financialEntryId: string | null;
}
