import { CompensateCanceledSaleUseCase } from '#/application/use-cases/compensate-canceled-sale.use-case';
import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import { ReconcileRegisterClosureUseCase } from '#/application/use-cases/reconcile-register-closure.use-case';
import {
  InMemoryManagementTransactionRunner,
  createRegisterClosedEventFixture,
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture
} from '../../../support/in-memory-management-test-doubles';

describe('ReconcileRegisterClosureUseCase', () => {
  it('reconciles a balanced register using the opening float plus net cash sales', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const consolidateCompletedSaleUseCase = new ConsolidateCompletedSaleUseCase(transactionRunner);
    const useCase = new ReconcileRegisterClosureUseCase(transactionRunner);

    await consolidateCompletedSaleUseCase.execute({
      event: createSaleCompletedEventFixture()
    });

    const response = await useCase.execute({
      event: createRegisterClosedEventFixture()
    });

    expect(response).toMatchObject({
      processingStatus: 'processed',
      expectedCashAmount: 142.5,
      differenceAmount: 0,
      reconciliationStatus: 'BALANCED'
    });
    expect(transactionRunner.cashReconciliationRepository.all()).toHaveLength(1);
  });

  it('uses the net cash position after a completed sale is later canceled', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const consolidateCompletedSaleUseCase = new ConsolidateCompletedSaleUseCase(transactionRunner);
    const compensateCanceledSaleUseCase = new CompensateCanceledSaleUseCase(transactionRunner);
    const useCase = new ReconcileRegisterClosureUseCase(transactionRunner);

    await consolidateCompletedSaleUseCase.execute({
      event: createSaleCompletedEventFixture()
    });
    await compensateCanceledSaleUseCase.execute({
      event: createSaleCanceledEventFixture()
    });

    const response = await useCase.execute({
      event: createRegisterClosedEventFixture({
        declaredCashAmount: 100
      })
    });

    expect(response).toMatchObject({
      processingStatus: 'processed',
      expectedCashAmount: 100,
      differenceAmount: 0,
      reconciliationStatus: 'BALANCED'
    });
  });
});
