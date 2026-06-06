import type { IntegrationEventPublicationStatus } from './integration-event-publication-status';

export interface UpdateProductPriceInputDto {
  tenantId: string;
  productId: string;
  price: number;
}

export interface UpdateProductPriceOutputDto {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  currentPrice: number;
  previousPrice: number;
  active: boolean;
  eventPublicationStatus: IntegrationEventPublicationStatus;
}
