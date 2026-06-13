import type { DataSource, EntityManager } from 'typeorm';

import { PhysicalInventoryAdjustment } from '#/domain/entities/physical-inventory-adjustment.entity';
import type { PhysicalInventoryAdjustmentRepositoryPort } from '#/domain/repositories/physical-inventory-adjustment.repository';
import { PhysicalInventoryAdjustmentTypeormEntity } from '../entities/physical-inventory-adjustment.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormPhysicalInventoryAdjustmentRepository
  implements PhysicalInventoryAdjustmentRepositoryPort
{
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async save(adjustment: PhysicalInventoryAdjustment): Promise<void> {
    const adjustmentState = adjustment.toPrimitives();

    await this.repositoryAccessor.getRepository(PhysicalInventoryAdjustmentTypeormEntity).save({
      id: adjustmentState.id,
      tenantId: adjustmentState.tenantId,
      productId: adjustmentState.productId,
      collectorId: adjustmentState.collectorId,
      previousOnHandQuantity: adjustmentState.previousOnHandQuantity,
      countedQuantity: adjustmentState.countedQuantity,
      quantityDelta: adjustmentState.quantityDelta,
      minimumThreshold: adjustmentState.minimumThreshold,
      reason: adjustmentState.reason,
      occurredAt: new Date(adjustmentState.occurredAt),
      createdAt: new Date(adjustmentState.createdAt)
    });
  }
}
