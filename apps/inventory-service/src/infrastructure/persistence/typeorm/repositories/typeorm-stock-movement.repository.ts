import type { DataSource, EntityManager } from 'typeorm';

import { StockMovement } from '#/domain/entities/stock-movement.entity';
import type { StockMovementRepositoryPort } from '#/domain/repositories/stock-movement.repository';
import { StockMovementTypeormEntity } from '../entities/stock-movement.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormStockMovementRepository implements StockMovementRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async save(movement: StockMovement): Promise<void> {
    const movementState = movement.toPrimitives();

    await this.repositoryAccessor.getRepository(StockMovementTypeormEntity).save({
      id: movementState.id,
      tenantId: movementState.tenantId,
      productId: movementState.productId,
      movementType: movementState.movementType,
      quantityDelta: movementState.quantityDelta,
      referenceId: movementState.referenceId,
      referenceEventId: movementState.referenceEventId,
      reason: movementState.reason,
      occurredAt: new Date(movementState.occurredAt),
      createdAt: new Date(movementState.createdAt)
    });
  }
}
