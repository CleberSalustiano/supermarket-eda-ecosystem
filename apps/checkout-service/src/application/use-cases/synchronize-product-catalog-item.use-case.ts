import { Inject, Injectable } from '@nestjs/common';

import type {
  SynchronizeProductCatalogItemInputDto,
  SynchronizeProductCatalogItemOutputDto
} from '../dto/synchronize-product-catalog-item.dto';
import {
  PRODUCT_CATALOG_ITEM_REPOSITORY,
  type ProductCatalogItemRepositoryPort
} from '../../domain/repositories/product-catalog-item.repository';
import {
  ProductCatalogItem,
  type ProductCatalogItemUpdateStatus
} from '../../domain/entities/product-catalog-item.entity';

@Injectable()
export class SynchronizeProductCatalogItemUseCase {
  constructor(
    @Inject(PRODUCT_CATALOG_ITEM_REPOSITORY)
    private readonly productCatalogItemRepository: ProductCatalogItemRepositoryPort
  ) {}

  async execute(
    input: SynchronizeProductCatalogItemInputDto
  ): Promise<SynchronizeProductCatalogItemOutputDto> {
    const { event } = input;
    const existingItem = await this.productCatalogItemRepository.findByProductId(
      event.tenantId,
      event.payload.productId
    );

    if (existingItem === null) {
      const item = ProductCatalogItem.synchronize({
        productId: event.payload.productId,
        tenantId: event.payload.tenantId,
        barcode: event.payload.barcode,
        name: event.payload.name,
        unitOfMeasure: event.payload.unitOfMeasure,
        unitPrice: event.payload.unitPrice,
        active: event.payload.active,
        priceUpdatedAt: new Date(event.occurredAt)
      });

      await this.productCatalogItemRepository.save(item);

      const itemState = item.toPrimitives();

      return {
        productId: itemState.productId,
        tenantId: itemState.tenantId,
        barcode: itemState.barcode,
        synchronizationStatus: 'created',
        priceUpdatedAt: itemState.priceUpdatedAt
      };
    }

    const synchronizationStatus = applyEventToExistingItem(existingItem, event);
    const itemState = existingItem.toPrimitives();

    if (synchronizationStatus === 'updated') {
      await this.productCatalogItemRepository.save(existingItem);
    }

    return {
      productId: itemState.productId,
      tenantId: itemState.tenantId,
      barcode: itemState.barcode,
      synchronizationStatus,
      priceUpdatedAt: itemState.priceUpdatedAt
    };
  }
}

function applyEventToExistingItem(
  item: ProductCatalogItem,
  event: SynchronizeProductCatalogItemInputDto['event']
): ProductCatalogItemUpdateStatus {
  return item.applyPriceUpdate({
    barcode: event.payload.barcode,
    name: event.payload.name,
    unitOfMeasure: event.payload.unitOfMeasure,
    unitPrice: event.payload.unitPrice,
    active: event.payload.active,
    priceUpdatedAt: new Date(event.occurredAt)
  });
}
