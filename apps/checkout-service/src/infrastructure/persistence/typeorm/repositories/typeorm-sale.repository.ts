import type { DataSource, EntityManager } from 'typeorm';

import type { SaleRepositoryPort } from '#/domain/repositories/sale.repository';
import { Sale } from '#/domain/entities/sale.entity';
import { SaleItemTypeormEntity } from '../entities/sale-item.typeorm-entity';
import { SaleTypeormEntity } from '../entities/sale.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormSaleRepository implements SaleRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findById(tenantId: string, saleId: string): Promise<Sale | null> {
    const entity = await this.repositoryAccessor.getRepository(SaleTypeormEntity).findOne({
      where: {
        id: saleId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(sale: Sale): Promise<void> {
    const saleState = sale.toPrimitives();
    const saleRepository = this.repositoryAccessor.getRepository(SaleTypeormEntity);
    const saleItemRepository = this.repositoryAccessor.getRepository(SaleItemTypeormEntity);

    await saleRepository.save({
      id: saleState.id,
      tenantId: saleState.tenantId,
      sessionId: saleState.sessionId,
      status: saleState.status,
      totalItemsQuantity: saleState.totalItemsQuantity,
      subtotal: saleState.subtotal,
      total: saleState.total,
      createdAt: new Date(saleState.createdAt),
      updatedAt: new Date(saleState.updatedAt)
    });

    await saleItemRepository.delete({
      saleId: saleState.id
    });

    if (saleState.items.length === 0) {
      return;
    }

    await saleItemRepository.save(
      saleState.items.map((item) => ({
        saleId: saleState.id,
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        unitOfMeasure: item.unitOfMeasure,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal
      }))
    );
  }
}

function toDomain(entity: SaleTypeormEntity): Sale {
  return Sale.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    sessionId: entity.sessionId,
    status: entity.status as 'OPEN' | 'PAID' | 'COMPLETED' | 'CANCELED',
    totalItemsQuantity: entity.totalItemsQuantity,
    subtotal: entity.subtotal,
    total: entity.total,
    items: entity.items.map((item) => ({
      productId: item.productId,
      barcode: item.barcode,
      name: item.name,
      unitOfMeasure: item.unitOfMeasure,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal
    })),
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
