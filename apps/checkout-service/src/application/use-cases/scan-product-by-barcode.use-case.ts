import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError, ResourceNotFoundError } from '@supermarket/shared-domain';

import type {
  ScanProductByBarcodeInputDto,
  ScanProductByBarcodeOutputDto
} from '../dto/scan-product-by-barcode.dto';
import type { ProductCatalogItemRepositoryPort } from '#/domain/repositories/product-catalog-item.repository';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from '#/domain/repositories/product-catalog-item.repository';

@Injectable()
export class ScanProductByBarcodeUseCase {
  constructor(
    @Inject(PRODUCT_CATALOG_ITEM_REPOSITORY)
    private readonly productCatalogItemRepository: ProductCatalogItemRepositoryPort
  ) {}

  async execute(input: ScanProductByBarcodeInputDto): Promise<ScanProductByBarcodeOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const barcode = normalizeRequiredValue(input.barcode, 'Barcode');
    const item = await this.productCatalogItemRepository.findByBarcode(tenantId, barcode);

    if (!item) {
      throw new ResourceNotFoundError(
        `Barcode ${barcode} was not found in the local catalog for tenant ${tenantId}`
      );
    }

    item.ensureAvailableForSale();

    const itemState = item.toPrimitives();

    return {
      productId: itemState.productId,
      tenantId: itemState.tenantId,
      barcode: itemState.barcode,
      name: itemState.name,
      unitOfMeasure: itemState.unitOfMeasure,
      unitPrice: itemState.unitPrice,
      active: itemState.active,
      priceUpdatedAt: itemState.priceUpdatedAt
    };
  }
}

function normalizeRequiredValue(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}
