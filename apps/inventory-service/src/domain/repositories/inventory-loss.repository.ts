import type { InventoryLoss } from '#/domain/entities/inventory-loss.entity';

export const INVENTORY_LOSS_REPOSITORY = Symbol('INVENTORY_LOSS_REPOSITORY');

export interface InventoryLossRepositoryPort {
  save(loss: InventoryLoss): Promise<void>;
}
