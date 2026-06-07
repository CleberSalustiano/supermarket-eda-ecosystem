import { ConflictError, ResourceNotFoundError } from '@supermarket/shared-domain';

import { ScanProductByBarcodeUseCase } from '#/application/use-cases/scan-product-by-barcode.use-case';
import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import { InMemoryProductCatalogItemRepository } from '../../../support/in-memory-checkout-test-doubles';

describe('ScanProductByBarcodeUseCase', () => {
  it('returns a locally cached product for scan operations', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new ScanProductByBarcodeUseCase(repository);
    const item = ProductCatalogItem.synchronize({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: new Date('2026-06-07T12:00:00.000Z')
    });

    await repository.save(item);

    const result = await useCase.execute({
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200'
    });

    expect(result).toMatchObject({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      name: 'Orange Juice',
      unitPrice: 9.9
    });
  });

  it('fails when the barcode is not cached locally', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new ScanProductByBarcodeUseCase(repository);

    await expect(
      useCase.execute({
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200'
      })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('fails when the cached product is inactive', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new ScanProductByBarcodeUseCase(repository);
    const item = ProductCatalogItem.synchronize({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: false,
      priceUpdatedAt: new Date('2026-06-07T12:00:00.000Z')
    });

    await repository.save(item);

    await expect(
      useCase.execute({
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200'
      })
    ).rejects.toThrow(ConflictError);
  });
});
