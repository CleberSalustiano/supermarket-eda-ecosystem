import { SalePaymentMethod } from '@supermarket/shared-domain';

import { CompleteSaleUseCase } from '#/application/use-cases/complete-sale.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  FakeOutboxEventRelay,
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('CompleteSaleUseCase', () => {
  it('completes a paid sale and dispatches its outbox event', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new CompleteSaleUseCase(transactionRunner, outboxEventRelay);
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
      saleId: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0'
    });

    expect(result).toMatchObject({
      status: 'COMPLETED',
      eventPublicationStatus: 'published',
      receipt: {
        paymentMethod: SalePaymentMethod.Cash,
        total: 9.9
      }
    });
    expect(transactionRunner.context.outboxEventRepository.findById).toBeDefined();
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });

  it('returns a pending publication status when the relay cannot publish immediately', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('pending');
    const useCase = new CompleteSaleUseCase(transactionRunner, outboxEventRelay);
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
      saleId: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0'
    });

    expect(result.eventPublicationStatus).toBe('pending');
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });
});
