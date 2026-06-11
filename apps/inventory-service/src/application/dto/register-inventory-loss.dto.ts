import type { IntegrationEventPublicationStatus } from '#/application/dto/integration-event-publication-status';
import type { InventoryLossReason } from '@supermarket/shared-domain';

export interface RegisterInventoryLossInputDto {
  tenantId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes?: string | null;
  occurredAt?: string;
}

export interface RegisterInventoryLossOutputDto {
  lossId: string;
  tenantId: string;
  productId: string;
  stockMovementId: string;
  onHandQuantity: number;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}
