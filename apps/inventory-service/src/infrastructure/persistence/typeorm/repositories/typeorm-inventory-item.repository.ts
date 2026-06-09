import type { DataSource, EntityManager } from 'typeorm';

import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import type { InventoryItemRepositoryPort } from '#/domain/repositories/inventory-item.repository';
import { InventoryItemTypeormEntity } from '../entities/inventory-item.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormInventoryItemRepository implements InventoryItemRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findByProductId(tenantId: string, productId: string): Promise<InventoryItem | null> {
    const entity = await this.repositoryAccessor.getRepository(InventoryItemTypeormEntity).findOne({
      where: {
        productId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(item: InventoryItem): Promise<void> {
    const itemState = item.toPrimitives();

    await this.repositoryAccessor.getRepository(InventoryItemTypeormEntity).save({
      productId: itemState.productId,
      tenantId: itemState.tenantId,
      barcode: itemState.barcode,
      name: itemState.name,
      unitOfMeasure: itemState.unitOfMeasure,
      onHandQuantity: itemState.onHandQuantity,
      minimumThreshold: itemState.minimumThreshold,
      createdAt: new Date(itemState.createdAt),
      updatedAt: new Date(itemState.updatedAt)
    });
  }
}

function toDomain(entity: InventoryItemTypeormEntity): InventoryItem {
  return InventoryItem.rehydrate({
    productId: entity.productId,
    tenantId: entity.tenantId,
    barcode: entity.barcode,
    name: entity.name,
    unitOfMeasure: entity.unitOfMeasure,
    onHandQuantity: entity.onHandQuantity,
    minimumThreshold: entity.minimumThreshold,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
