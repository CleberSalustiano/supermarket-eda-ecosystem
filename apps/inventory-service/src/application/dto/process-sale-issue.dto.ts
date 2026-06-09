import type { EventEnvelope, SaleCompletedEventPayload } from '@supermarket/shared-domain';

export interface ProcessSaleIssueInputDto {
  event: EventEnvelope<SaleCompletedEventPayload>;
}

export type SaleIssueProcessingStatus = 'processed' | 'ignored';

export interface ProcessSaleIssueOutputDto {
  saleId: string;
  tenantId: string;
  processedEventId: string;
  processingStatus: SaleIssueProcessingStatus;
  affectedItemsCount: number;
  stockMovementCount: number;
}
