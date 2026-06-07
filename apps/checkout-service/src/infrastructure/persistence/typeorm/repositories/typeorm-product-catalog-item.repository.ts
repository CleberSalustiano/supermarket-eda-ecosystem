import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type { ProductCatalogItemRepositoryPort } from '#/domain/repositories/product-catalog-item.repository';
import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import { ProductCatalogItemTypeormEntity } from '../entities/product-catalog-item.typeorm-entity';

@Injectable()
export class TypeormProductCatalogItemRepository implements ProductCatalogItemRepositoryPort {
  constructor(private readonly dataSource: DataSource) {}

  async findByProductId(tenantId: string, productId: string): Promise<ProductCatalogItem | null> {
    const entity = await this.dataSource.getRepository(ProductCatalogItemTypeormEntity).findOne({
      where: {
        productId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<ProductCatalogItem | null> {
    const entity = await this.dataSource.getRepository(ProductCatalogItemTypeormEntity).findOne({
      where: {
        barcode,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(item: ProductCatalogItem): Promise<void> {
    const itemState = item.toPrimitives();

    await this.dataSource.getRepository(ProductCatalogItemTypeormEntity).save({
      productId: itemState.productId,
      tenantId: itemState.tenantId,
      barcode: itemState.barcode,
      name: itemState.name,
      unitOfMeasure: itemState.unitOfMeasure,
      unitPrice: itemState.unitPrice,
      active: itemState.active,
      priceUpdatedAt: new Date(itemState.priceUpdatedAt),
      createdAt: new Date(itemState.createdAt),
      updatedAt: new Date(itemState.updatedAt)
    });
  }
}

function toDomain(entity: ProductCatalogItemTypeormEntity): ProductCatalogItem {
  return ProductCatalogItem.rehydrate({
    productId: entity.productId,
    tenantId: entity.tenantId,
    barcode: entity.barcode,
    name: entity.name,
    unitOfMeasure: entity.unitOfMeasure,
    unitPrice: entity.unitPrice,
    active: entity.active,
    priceUpdatedAt: entity.priceUpdatedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
