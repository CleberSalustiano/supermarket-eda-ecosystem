import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import type { ProductCatalogItemRepositoryPort } from '#/domain/repositories/product-catalog-item.repository';

export class InMemoryProductCatalogItemRepository implements ProductCatalogItemRepositoryPort {
  private readonly items = new Map<string, ProductCatalogItem>();

  async findByProductId(
    tenantId: string,
    productId: string
  ): Promise<ProductCatalogItem | null> {
    return this.items.get(buildKey(tenantId, productId)) ?? null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<ProductCatalogItem | null> {
    return (
      [...this.items.values()].find((item) => {
        const itemState = item.toPrimitives();

        return itemState.tenantId === tenantId && itemState.barcode === barcode.trim();
      }) ?? null
    );
  }

  async save(item: ProductCatalogItem): Promise<void> {
    const itemState = item.toPrimitives();

    this.items.set(buildKey(itemState.tenantId, itemState.productId), item);
  }

  all(): ProductCatalogItem[] {
    return [...this.items.values()];
  }
}

function buildKey(tenantId: string, productId: string): string {
  return `${tenantId}:${productId}`;
}
