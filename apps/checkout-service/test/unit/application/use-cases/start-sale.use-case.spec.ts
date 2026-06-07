import { ResourceNotFoundError } from '@supermarket/shared-domain';

import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { PosSession } from '#/domain/entities/pos-session.entity';
import {
  InMemoryCheckoutTransactionRunner,
  InMemoryPosSessionRepository
} from '../../../support/in-memory-checkout-test-doubles';

describe('StartSaleUseCase', () => {
  it('starts a sale for an open session', async () => {
    const posSessionRepository = new InMemoryPosSessionRepository();
    const transactionRunner = new InMemoryCheckoutTransactionRunner({
      posSessionRepository
    });
    const useCase = new StartSaleUseCase(transactionRunner);
    const session = PosSession.open({
      id: '139c3422-f02a-4daa-a85e-a9f6260f0684',
      tenantId: 'ca1b9984-b2df-461c-bd8a-6fb0f1155d4f',
      registerId: 'register-02',
      operatorId: '5d3e534c-99f3-4bd9-8bce-3121a5888862',
      openingFloatAmount: 100
    });

    await posSessionRepository.save(session);

    const result = await useCase.execute({
      tenantId: 'ca1b9984-b2df-461c-bd8a-6fb0f1155d4f',
      sessionId: '139c3422-f02a-4daa-a85e-a9f6260f0684'
    });

    expect(result).toMatchObject({
      tenantId: 'ca1b9984-b2df-461c-bd8a-6fb0f1155d4f',
      sessionId: '139c3422-f02a-4daa-a85e-a9f6260f0684',
      status: 'OPEN',
      totalItemsQuantity: 0,
      items: []
    });
  });

  it('returns not found when the session does not exist', async () => {
    const transactionRunner = new InMemoryCheckoutTransactionRunner();
    const useCase = new StartSaleUseCase(transactionRunner);

    await expect(
      useCase.execute({
        tenantId: 'ca1b9984-b2df-461c-bd8a-6fb0f1155d4f',
        sessionId: '139c3422-f02a-4daa-a85e-a9f6260f0684'
      })
    ).rejects.toThrow(ResourceNotFoundError);
  });
});
