import { SalePaymentMethod } from '@supermarket/shared-domain';

import { CancelSaleUseCase } from '#/application/use-cases/cancel-sale.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  FakeOutboxEventRelay,
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('CancelSaleUseCase', () => {
  it('cancels a completed sale and dispatches a SaleCanceled outbox event', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new CancelSaleUseCase(transactionRunner, outboxEventRelay);
    const sale = Sale.start({
      id: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0',
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      sessionId: '4bc1f77c-ae63-40c3-9210-ea3e6f868a50'
    });

    sale.addItem({
      productId: '0df11434-3b4d-49de-844c-535b6d15922f',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    sale.registerPayment({
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20
    });
    sale.complete(new Date('2026-06-10T12:00:00.000Z'));
    await posSessionRepository.save(
      PosSession.open({
        id: '4bc1f77c-ae63-40c3-9210-ea3e6f868a50',
        tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
        registerId: 'register-09',
        operatorId: '120c68ba-67ef-40fa-a4b3-76f970899720',
        openingFloatAmount: 90
      })
    );
    await saleRepository.save(sale);

    const result = await useCase.execute({
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      saleId: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0',
      reason: 'Customer requested reversal after price mismatch',
      managerApprovalCode: 'MGR-42'
    });

    expect(result).toMatchObject({
      status: 'CANCELED',
      cancellationReason: 'Customer requested reversal after price mismatch',
      eventPublicationStatus: 'published'
    });
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });
});
