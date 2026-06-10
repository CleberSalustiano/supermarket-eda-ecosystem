import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';
import {
  InMemoryManagementTransactionRunner,
  createSaleCompletedEventFixture
} from '../../../support/in-memory-management-test-doubles';

describe('ConsolidateCompletedSaleUseCase', () => {
  it('stores an immutable financial entry and accumulates the daily projection', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new ConsolidateCompletedSaleUseCase(transactionRunner);

    const response = await useCase.execute({
      event: createSaleCompletedEventFixture()
    });

    expect(response).toMatchObject({
      processingStatus: 'processed',
      businessDate: '2026-06-09'
    });
    expect(transactionRunner.financialEntryRepository.all()).toHaveLength(1);
    expect(transactionRunner.dailyFinancialConsolidationRepository.all()).toHaveLength(1);
    expect(
      transactionRunner.dailyFinancialConsolidationRepository.all()[0]?.toPrimitives()
    ).toMatchObject({
      grossSalesTotal: 42.5,
      salesCount: 1,
      soldItemsQuantity: 3
    });
  });

  it('ignores a duplicate SaleCompleted event id', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new ConsolidateCompletedSaleUseCase(transactionRunner);
    const event = createSaleCompletedEventFixture();

    await useCase.execute({ event });
    const response = await useCase.execute({ event });

    expect(response).toMatchObject({
      processingStatus: 'ignored',
      financialEntryId: null
    });
    expect(transactionRunner.financialEntryRepository.all()).toHaveLength(1);
    expect(transactionRunner.dailyFinancialConsolidationRepository.all()).toHaveLength(1);
  });
});
