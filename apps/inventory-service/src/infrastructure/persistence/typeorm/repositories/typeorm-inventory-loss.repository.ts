import type { DataSource, EntityManager } from 'typeorm';

import { InventoryLoss } from '#/domain/entities/inventory-loss.entity';
import type { InventoryLossRepositoryPort } from '#/domain/repositories/inventory-loss.repository';
import { InventoryLossTypeormEntity } from '../entities/inventory-loss.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormInventoryLossRepository implements InventoryLossRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async save(loss: InventoryLoss): Promise<void> {
    const lossState = loss.toPrimitives();

    await this.repositoryAccessor.getRepository(InventoryLossTypeormEntity).save({
      id: lossState.id,
      tenantId: lossState.tenantId,
      productId: lossState.productId,
      quantity: lossState.quantity,
      reasonCode: lossState.reasonCode,
      notes: lossState.notes,
      occurredAt: new Date(lossState.occurredAt),
      createdAt: new Date(lossState.createdAt)
    });
  }
}
