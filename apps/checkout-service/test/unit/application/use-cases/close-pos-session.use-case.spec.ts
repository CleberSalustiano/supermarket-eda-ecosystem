import { ConflictError } from '@supermarket/shared-domain';

import { ClosePosSessionUseCase } from '#/application/use-cases/close-pos-session.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { Sale } from '#/domain/entities/sale.entity';
import {
  FakeOutboxEventRelay,
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository,
  InMemorySaleRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('ClosePosSessionUseCase', () => {
  it('closes a session when all its sales are terminal and dispatches RegisterClosed', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new ClosePosSessionUseCase(transactionRunner, outboxEventRelay);
    const session = PosSession.open({
      id: '4bc1f77c-ae63-40c3-9210-ea3e6f868a50',
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      registerId: 'register-09',
      operatorId: '120c68ba-67ef-40fa-a4b3-76f970899720',
      openingFloatAmount: 90
    });
    const sale = Sale.start({
      id: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0',
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      sessionId: session.toPrimitives().id
    });

    sale.cancel({
      reason: 'Customer abandoned before payment'
    });
    await posSessionRepository.save(session);
    await saleRepository.save(sale);

    const result = await useCase.execute({
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      sessionId: session.toPrimitives().id,
      declaredCashAmount: 165.3
    });

    expect(result).toMatchObject({
      status: 'CLOSED',
      declaredCashAmount: 165.3,
      eventPublicationStatus: 'published'
    });
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(1);
  });

  it('rejects closing a session while a sale is still open', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const saleRepository = new InMemorySaleRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository,
      saleRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new ClosePosSessionUseCase(transactionRunner, outboxEventRelay);
    const session = PosSession.open({
      id: '4bc1f77c-ae63-40c3-9210-ea3e6f868a50',
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      registerId: 'register-09',
      operatorId: '120c68ba-67ef-40fa-a4b3-76f970899720',
      openingFloatAmount: 90
    });
    const sale = Sale.start({
      id: '3aeb9ee2-2772-47ea-b7be-0d3723e749d0',
      tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
      sessionId: session.toPrimitives().id
    });

    await posSessionRepository.save(session);
    await saleRepository.save(sale);

    await expect(
      useCase.execute({
        tenantId: 'e8197b86-cff7-406b-b879-c3810a8e731d',
        sessionId: session.toPrimitives().id,
        declaredCashAmount: 165.3
      })
    ).rejects.toThrow(new ConflictError('POS session 4bc1f77c-ae63-40c3-9210-ea3e6f868a50 cannot be closed while it still has open or paid sales'));
  });
});
