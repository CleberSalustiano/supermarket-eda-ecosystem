import type {
  EventEnvelope,
  ProductPriceUpdatedEventPayload
} from '@supermarket/shared-domain';

export type ProductCatalogSynchronizationStatus = 'created' | 'updated' | 'ignored';

export interface SynchronizeProductCatalogItemInputDto {
  event: EventEnvelope<ProductPriceUpdatedEventPayload>;
}

export interface SynchronizeProductCatalogItemOutputDto {
  productId: string;
  tenantId: string;
  barcode: string;
  synchronizationStatus: ProductCatalogSynchronizationStatus;
  priceUpdatedAt: string;
}
