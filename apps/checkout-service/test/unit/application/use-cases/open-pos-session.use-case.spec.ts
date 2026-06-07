import { ConflictError } from '@supermarket/shared-domain';

import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { InMemoryCheckoutTransactionRunner } from '../../../support/in-memory-checkout-test-doubles';

describe('OpenPosSessionUseCase', () => {
  it('opens a new session when the register has no active session', async () => {
    const transactionRunner = new InMemoryCheckoutTransactionRunner();
    const useCase = new OpenPosSessionUseCase(transactionRunner);

    const result = await useCase.execute({
      tenantId: '321fcecf-47bf-4a18-a37e-dc78bdb599f9',
      registerId: 'register-01',
      operatorId: 'b99f3be4-627a-435d-9e8d-27d780e190f8',
      openingFloatAmount: 180
    });

    expect(result).toMatchObject({
      tenantId: '321fcecf-47bf-4a18-a37e-dc78bdb599f9',
      registerId: 'register-01',
      operatorId: 'b99f3be4-627a-435d-9e8d-27d780e190f8',
      openingFloatAmount: 180,
      status: 'OPEN'
    });
    expect(transactionRunner.context.posSessionRepository.findOpenByRegisterId).toBeDefined();
  });

  it('rejects opening a second active session for the same register', async () => {
    const transactionRunner = new InMemoryCheckoutTransactionRunner();
    const useCase = new OpenPosSessionUseCase(transactionRunner);
    const input = {
      tenantId: '321fcecf-47bf-4a18-a37e-dc78bdb599f9',
      registerId: 'register-01',
      operatorId: 'b99f3be4-627a-435d-9e8d-27d780e190f8',
      openingFloatAmount: 180
    };

    await useCase.execute(input);

    await expect(useCase.execute(input)).rejects.toThrow(ConflictError);
  });
});
