import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';

export interface EmitLowStockAlertsInputDto {
  emittedAt?: Date;
}

export interface EmitLowStockAlertBatchOutputDto {
  eventId: string;
  alertId: string;
  tenantId: string;
  itemsCount: number;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}

export interface EmitLowStockAlertsOutputDto {
  emittedAt: string;
  scannedCandidates: number;
  emittedBatches: EmitLowStockAlertBatchOutputDto[];
}
