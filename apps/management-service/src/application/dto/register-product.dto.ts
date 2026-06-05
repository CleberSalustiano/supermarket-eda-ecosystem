import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';

export interface RegisterProductInputDto {
  tenantId: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  price: number;
}

export interface RegisterProductOutputDto {
  productId: string;
  tenantId: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  currentPrice: number;
  active: boolean;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}
