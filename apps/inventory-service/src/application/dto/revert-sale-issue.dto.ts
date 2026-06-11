import type { EventEnvelope, SaleCanceledEventPayload } from '@supermarket/shared-domain';

export interface RevertSaleIssueInputDto {
  event: EventEnvelope<SaleCanceledEventPayload>;
}

export type SaleIssueReversionProcessingStatus = 'processed' | 'ignored' | 'skipped';

export interface RevertSaleIssueOutputDto {
  saleId: string;
  tenantId: string;
  processedEventId: string;
  processingStatus: SaleIssueReversionProcessingStatus;
  affectedItemsCount: number;
  stockMovementCount: number;
}
