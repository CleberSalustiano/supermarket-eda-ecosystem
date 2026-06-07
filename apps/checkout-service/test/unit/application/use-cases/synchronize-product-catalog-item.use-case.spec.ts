import { createProductPriceUpdatedEvent } from '@supermarket/shared-domain';

import { SynchronizeProductCatalogItemUseCase } from '#/application/use-cases/synchronize-product-catalog-item.use-case';
import { InMemoryProductCatalogItemRepository } from '../../../support/in-memory-checkout-test-doubles';

describe('SynchronizeProductCatalogItemUseCase', () => {
  it('creates a local catalog item when the product is seen for the first time', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new SynchronizeProductCatalogItemUseCase(repository);
    const event = createProductPriceUpdatedEvent({
      productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
      tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      previousUnitPrice: 8.5,
      active: true
    });

    const result = await useCase.execute({ event });

    expect(result).toMatchObject({
      productId: event.payload.productId,
      tenantId: event.payload.tenantId,
      barcode: event.payload.barcode,
      synchronizationStatus: 'created'
    });
    expect(repository.all()).toHaveLength(1);
  });

  it('updates an existing cached product when a newer event arrives', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new SynchronizeProductCatalogItemUseCase(repository);
    const initialEvent = {
      ...createProductPriceUpdatedEvent({
        productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        previousUnitPrice: 8.5,
        active: true
      }),
      occurredAt: '2026-06-07T11:00:00.000Z'
    };
    const updatedEvent = {
      ...createProductPriceUpdatedEvent({
        productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200',
        name: 'Orange Juice Premium',
        unitOfMeasure: 'unit',
        unitPrice: 10.45,
        previousUnitPrice: 9.9,
        active: true
      }),
      eventId: '9c80f444-9ce9-4564-9d33-159a69521d3f',
      occurredAt: '2026-06-07T12:00:00.000Z'
    };

    await useCase.execute({ event: initialEvent });
    const result = await useCase.execute({ event: updatedEvent });

    expect(result).toMatchObject({
      synchronizationStatus: 'updated',
      barcode: '7891000000200'
    });
    expect(repository.all()[0]?.toPrimitives()).toMatchObject({
      name: 'Orange Juice Premium',
      unitPrice: 10.45
    });
  });

  it('ignores stale product price events', async () => {
    const repository = new InMemoryProductCatalogItemRepository();
    const useCase = new SynchronizeProductCatalogItemUseCase(repository);
    const currentEvent = {
      ...createProductPriceUpdatedEvent({
        productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200',
        name: 'Orange Juice Premium',
        unitOfMeasure: 'unit',
        unitPrice: 10.45,
        previousUnitPrice: 9.9,
        active: true
      }),
      eventId: '9c80f444-9ce9-4564-9d33-159a69521d3f',
      occurredAt: '2026-06-07T12:00:00.000Z'
    };
    const staleEvent = {
      ...createProductPriceUpdatedEvent({
        productId: '7d6e4541-39df-47ec-aa6f-6f789dc1495b',
        tenantId: '7647d36b-a98d-4895-b3fd-c55579fa0860',
        barcode: '7891000000200',
        name: 'Outdated Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 8.75,
        previousUnitPrice: 7.99,
        active: false
      }),
      eventId: 'ac435bf4-a532-4ca1-9253-f43e2a2fb6fe',
      occurredAt: '2026-06-07T11:00:00.000Z'
    };

    await useCase.execute({ event: currentEvent });
    const result = await useCase.execute({ event: staleEvent });

    expect(result.synchronizationStatus).toBe('ignored');
    expect(repository.all()[0]?.toPrimitives()).toMatchObject({
      name: 'Orange Juice Premium',
      unitPrice: 10.45,
      active: true
    });
  });
});
