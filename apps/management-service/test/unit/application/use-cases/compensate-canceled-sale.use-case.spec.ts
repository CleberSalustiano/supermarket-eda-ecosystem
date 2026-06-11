import { CompensateCanceledSaleUseCase } from '#/application/use-cases/compensate-canceled-sale.use-case';
import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import {
  InMemoryManagementTransactionRunner,
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture
} from '../../../support/in-memory-management-test-doubles';

describe('CompensateCanceledSaleUseCase', () => {
  it('records a reversal entry for a canceled completed sale', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const consolidateCompletedSaleUseCase = new ConsolidateCompletedSaleUseCase(transactionRunner);
    const compensateCanceledSaleUseCase = new CompensateCanceledSaleUseCase(transactionRunner);

    await consolidateCompletedSaleUseCase.execute({
      event: createSaleCompletedEventFixture()
    });

    const response = await compensateCanceledSaleUseCase.execute({
      event: createSaleCanceledEventFixture()
    });

    expect(response).toMatchObject({
      processingStatus: 'processed',
      businessDate: '2026-06-09'
    });
    expect(transactionRunner.financialEntryRepository.all()).toHaveLength(2);
    expect(transactionRunner.financialEntryRepository.all()[1]?.toPrimitives()).toMatchObject({
      entryType: 'SALE_CANCELLATION_REVERSAL'
    });
  });

  it('skips a cancellation that arrives before the completed sale is consolidated', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new CompensateCanceledSaleUseCase(transactionRunner);

    const response = await useCase.execute({
      event: createSaleCanceledEventFixture()
    });

    expect(response).toMatchObject({
      processingStatus: 'skipped',
      financialEntryId: null
    });
    expect(transactionRunner.financialEntryRepository.all()).toHaveLength(0);
  });
});
