import type { ProductCatalogItem } from '../entities/product-catalog-item.entity';

export const PRODUCT_CATALOG_ITEM_REPOSITORY = Symbol('PRODUCT_CATALOG_ITEM_REPOSITORY');

export interface ProductCatalogItemRepositoryPort {
  findByProductId(tenantId: string, productId: string): Promise<ProductCatalogItem | null>;
  findByBarcode(tenantId: string, barcode: string): Promise<ProductCatalogItem | null>;
  save(item: ProductCatalogItem): Promise<void>;
}
