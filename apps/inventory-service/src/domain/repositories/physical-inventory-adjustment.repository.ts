import type { PhysicalInventoryAdjustment } from '#/domain/entities/physical-inventory-adjustment.entity';

export interface PhysicalInventoryAdjustmentRepositoryPort {
  save(adjustment: PhysicalInventoryAdjustment): Promise<void>;
}
