import type { EventEnvelope, SaleCanceledEventPayload } from '@supermarket/shared-domain';

export interface CompensateCanceledSaleInputDto {
  event: EventEnvelope<SaleCanceledEventPayload>;
}

export interface CompensateCanceledSaleOutputDto {
  saleId: string;
  tenantId: string;
  businessDate: string | null;
  processingStatus: 'processed' | 'ignored' | 'skipped';
  financialEntryId: string | null;
}
