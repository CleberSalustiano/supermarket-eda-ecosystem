import { ConflictError, ResourceNotFoundError } from '@supermarket/shared-domain';

import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemoryProductCatalogItemRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('AddSaleItemUseCase', () => {
  it('adds an item to the sale using the local catalog cache', async () => {
    const productCatalogItemRepository = new InMemoryProductCatalogItemRepository();
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      productCatalogItemRepository,
      posSessionRepository,
      saleRepository
    });
    const useCase = new AddSaleItemUseCase(transactionRunner);

    await productCatalogItemRepository.save(
      ProductCatalogItem.synchronize({
        productId: '9de82e6a-0980-4b94-a3da-84d594f05cdc',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        active: true,
        priceUpdatedAt: new Date('2026-06-07T12:00:00.000Z')
      })
    );
    await posSessionRepository.save(
      PosSession.open({
        id: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        registerId: 'register-04',
        operatorId: '34cf8244-c9fb-4761-b9de-2e322ed4ce2c',
        openingFloatAmount: 90
      })
    );
    await saleRepository.save(
      Sale.start({
        id: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        sessionId: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e'
      })
    );

    const result = await useCase.execute({
      tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
      saleId: 'f358088e-9cdc-4c50-a761-b99e21caf625',
      barcode: '7891000000200',
      quantity: 2
    });

    expect(result).toMatchObject({
      totalItemsQuantity: 2,
      subtotal: 19.8,
      items: [
        {
          barcode: '7891000000200',
          quantity: 2,
          lineTotal: 19.8
        }
      ]
    });
  });

  it('returns not found when the barcode is not in the local cache', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const useCase = new AddSaleItemUseCase(transactionRunner);

    await posSessionRepository.save(
      PosSession.open({
        id: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        registerId: 'register-04',
        operatorId: '34cf8244-c9fb-4761-b9de-2e322ed4ce2c',
        openingFloatAmount: 90
      })
    );
    await saleRepository.save(
      Sale.start({
        id: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        sessionId: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e'
      })
    );

    await expect(
      useCase.execute({
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        saleId: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        barcode: '7891000000200',
        quantity: 1
      })
    ).rejects.toThrow(ResourceNotFoundError);
  });

  it('blocks adding an inactive cached product', async () => {
    const productCatalogItemRepository = new InMemoryProductCatalogItemRepository();
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      productCatalogItemRepository,
      posSessionRepository,
      saleRepository
    });
    const useCase = new AddSaleItemUseCase(transactionRunner);

    await productCatalogItemRepository.save(
      ProductCatalogItem.synchronize({
        productId: '9de82e6a-0980-4b94-a3da-84d594f05cdc',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'unit',
        unitPrice: 9.9,
        active: false,
        priceUpdatedAt: new Date('2026-06-07T12:00:00.000Z')
      })
    );
    await posSessionRepository.save(
      PosSession.open({
        id: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        registerId: 'register-04',
        operatorId: '34cf8244-c9fb-4761-b9de-2e322ed4ce2c',
        openingFloatAmount: 90
      })
    );
    await saleRepository.save(
      Sale.start({
        id: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        sessionId: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e'
      })
    );

    await expect(
      useCase.execute({
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        saleId: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        barcode: '7891000000200',
        quantity: 1
      })
    ).rejects.toThrow(ConflictError);
  });
});
