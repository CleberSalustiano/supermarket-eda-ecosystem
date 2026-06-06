import type { Product } from '../entities/product.entity';

export interface ProductRepositoryPort {
  findById(tenantId: string, productId: string): Promise<Product | null>;
  findByBarcode(tenantId: string, barcode: string): Promise<Product | null>;
  save(product: Product): Promise<void>;
}
