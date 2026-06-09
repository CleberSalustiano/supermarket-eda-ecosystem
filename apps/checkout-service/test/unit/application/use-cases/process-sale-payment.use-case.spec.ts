import { ConflictError } from '@supermarket/shared-domain';
import { SalePaymentMethod } from '@supermarket/shared-domain';

import { ProcessSalePaymentUseCase } from '#/application/use-cases/process-sale-payment.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('ProcessSalePaymentUseCase', () => {
  it('registers a cash payment and transitions the sale to paid', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const useCase = new ProcessSalePaymentUseCase(transactionRunner);
    const sale = Sale.start({
      id: 'a271279f-e4fd-40cb-bb66-39abf32de65a',
      tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
      sessionId: '12438e5d-c86e-4c60-a3e6-bc86e0377841'
    });

    sale.addItem({
      productId: '0df11434-3b4d-49de-844c-535b6d15922f',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    await posSessionRepository.save(
      PosSession.open({
        id: '12438e5d-c86e-4c60-a3e6-bc86e0377841',
        tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
        registerId: 'register-07',
        operatorId: '91c26a55-12c1-4ef0-9d8a-c2d0d3ed8cf2',
        openingFloatAmount: 150
      })
    );
    await saleRepository.save(sale);

    const result = await useCase.execute({
      tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
      saleId: 'a271279f-e4fd-40cb-bb66-39abf32de65a',
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20
    });

    expect(result).toMatchObject({
      status: 'PAID',
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20,
      changeAmount: 10.1
    });
  });

  it('rejects non-cash payments that do not match the sale total', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const useCase = new ProcessSalePaymentUseCase(transactionRunner);
    const sale = Sale.start({
      id: 'a271279f-e4fd-40cb-bb66-39abf32de65a',
      tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
      sessionId: '12438e5d-c86e-4c60-a3e6-bc86e0377841'
    });

    sale.addItem({
      productId: '0df11434-3b4d-49de-844c-535b6d15922f',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    await posSessionRepository.save(
      PosSession.open({
        id: '12438e5d-c86e-4c60-a3e6-bc86e0377841',
        tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
        registerId: 'register-07',
        operatorId: '91c26a55-12c1-4ef0-9d8a-c2d0d3ed8cf2',
        openingFloatAmount: 150
      })
    );
    await saleRepository.save(sale);

    await expect(
      useCase.execute({
        tenantId: '4b411dbc-4c2e-4d0e-9be0-6df9165dd92d',
        saleId: 'a271279f-e4fd-40cb-bb66-39abf32de65a',
        paymentMethod: SalePaymentMethod.Pix,
        paidAmount: 10
      })
    ).rejects.toThrow(ConflictError);
  });
});
