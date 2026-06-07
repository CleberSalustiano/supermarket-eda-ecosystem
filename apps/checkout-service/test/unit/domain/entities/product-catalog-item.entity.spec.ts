import { ConflictError, DomainValidationError } from '@supermarket/shared-domain';

import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';

describe('ProductCatalogItem', () => {
  it('synchronizes a valid local catalog item with normalized values', () => {
    const item = ProductCatalogItem.synchronize({
      productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
      tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
      barcode: ' 7891000000200 ',
      name: ' Orange Juice ',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: new Date('2026-06-07T10:00:00.000Z')
    });

    expect(item.toPrimitives()).toMatchObject({
      productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
      tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: '2026-06-07T10:00:00.000Z'
    });
  });

  it('applies a newer price update and preserves the latest snapshot', () => {
    const item = ProductCatalogItem.synchronize({
      productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
      tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: new Date('2026-06-07T10:00:00.000Z')
    });

    const updateStatus = item.applyPriceUpdate({
      barcode: '7891000000200',
      name: 'Orange Juice Premium',
      unitOfMeasure: 'unit',
      unitPrice: 10.45,
      active: false,
      priceUpdatedAt: new Date('2026-06-07T11:00:00.000Z')
    });

    expect(updateStatus).toBe('updated');
    expect(item.toPrimitives()).toMatchObject({
      name: 'Orange Juice Premium',
      unitPrice: 10.45,
      active: false,
      priceUpdatedAt: '2026-06-07T11:00:00.000Z'
    });
  });

  it('ignores stale price events', () => {
    const item = ProductCatalogItem.synchronize({
      productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
      tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: new Date('2026-06-07T11:00:00.000Z')
    });

    const updateStatus = item.applyPriceUpdate({
      barcode: '7891000000200',
      name: 'Outdated Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 8.5,
      active: false,
      priceUpdatedAt: new Date('2026-06-07T10:00:00.000Z')
    });

    expect(updateStatus).toBe('ignored');
    expect(item.toPrimitives()).toMatchObject({
      name: 'Orange Juice',
      unitPrice: 9.9,
      active: true,
      priceUpdatedAt: '2026-06-07T11:00:00.000Z'
    });
  });

  it('blocks scan usage for inactive products', () => {
    const item = ProductCatalogItem.synchronize({
      productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
      tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      active: false,
      priceUpdatedAt: new Date('2026-06-07T10:00:00.000Z')
    });

    expect(() => item.ensureAvailableForSale()).toThrow(ConflictError);
  });

  it('rejects invalid prices during synchronization', () => {
    expect(() =>
      ProductCatalogItem.synchronize({
        productId: '63ba50c7-e74d-42dd-a69f-c5575114efba',
        tenantId: '0f400a4f-cc95-4fd8-b81f-b9fdf3ac2738',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 0,
        active: true,
        priceUpdatedAt: new Date('2026-06-07T10:00:00.000Z')
      })
    ).toThrow(DomainValidationError);
  });
});
