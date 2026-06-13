import type { InventoryItem } from '../entities/inventory-item.entity';

export const INVENTORY_ITEM_REPOSITORY = Symbol('INVENTORY_ITEM_REPOSITORY');

export interface InventoryItemRepositoryPort {
  findByProductId(tenantId: string, productId: string): Promise<InventoryItem | null>;
  findLowStockCandidates(cooldownCutoff: Date, limit: number): Promise<InventoryItem[]>;
  save(item: InventoryItem): Promise<void>;
}
