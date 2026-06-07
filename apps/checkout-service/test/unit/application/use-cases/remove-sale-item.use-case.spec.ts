import { ResourceNotFoundError } from '@supermarket/shared-domain';

import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('RemoveSaleItemUseCase', () => {
  it('removes a quantity from an existing sale line', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const useCase = new RemoveSaleItemUseCase(transactionRunner);
    const sale = Sale.start({
      id: 'f358088e-9cdc-4c50-a761-b99e21caf625',
      tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
      sessionId: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e'
    });

    sale.addItem({
      productId: '9de82e6a-0980-4b94-a3da-84d594f05cdc',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 3
    });
    await posSessionRepository.save(
      PosSession.open({
        id: 'f5d1f1be-cf4d-4f62-8f86-51eb518fce4e',
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        registerId: 'register-04',
        operatorId: '34cf8244-c9fb-4761-b9de-2e322ed4ce2c',
        openingFloatAmount: 90
      })
    );
    await saleRepository.save(sale);

    const result = await useCase.execute({
      tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
      saleId: 'f358088e-9cdc-4c50-a761-b99e21caf625',
      barcode: '7891000000200',
      quantity: 2
    });

    expect(result).toMatchObject({
      totalItemsQuantity: 1,
      subtotal: 9.9,
      items: [
        {
          barcode: '7891000000200',
          quantity: 1
        }
      ]
    });
  });

  it('returns not found when the sale does not exist', async () => {
    const transactionRunner = new InMemoryCheckoutTransactionRunner();
    const useCase = new RemoveSaleItemUseCase(transactionRunner);

    await expect(
      useCase.execute({
        tenantId: '7f6ec5d1-b0f9-4d9a-9bf6-cd65a4393065',
        saleId: 'f358088e-9cdc-4c50-a761-b99e21caf625',
        barcode: '7891000000200',
        quantity: 1
      })
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
