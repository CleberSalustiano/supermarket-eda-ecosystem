import { ResourceNotFoundError } from '@supermarket/shared-domain';

import { CaptureInventoryLossUseCase } from '#/application/use-cases/capture-inventory-loss.use-case';
import { Product } from '#/domain/entities/product.entity';
import {
  createInventoryLossRegisteredEventFixture,
  InMemoryManagementTransactionRunner
} from '../../../support/in-memory-management-test-doubles';

describe('CaptureInventoryLossUseCase', () => {
  it('stores a valued loss entry once and tracks the processed event', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new CaptureInventoryLossUseCase(transactionRunner);

    await transactionRunner.productRepository.save(
      Product.register({
        id: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        name: 'Ground Coffee',
        barcode: '7891000000410',
        unitOfMeasure: 'UNIT',
        currentPrice: 14.17
      })
    );

    const response = await useCase.execute({
      event: createInventoryLossRegisteredEventFixture()
    });

    expect(response).toMatchObject({
      processingStatus: 'processed',
      businessDate: '2026-06-09'
    });
    expect(transactionRunner.inventoryLossEntryRepository.all()).toHaveLength(1);
    expect(transactionRunner.processedEventRepository.all()).toHaveLength(1);
    expect(transactionRunner.inventoryLossEntryRepository.all()[0]?.toPrimitives()).toMatchObject({
      totalLossAmount: 28.34,
      unitPrice: 14.17,
      quantity: 2
    });
  });

  it('ignores a duplicate InventoryLossRegistered event id', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new CaptureInventoryLossUseCase(transactionRunner);

    await transactionRunner.productRepository.save(
      Product.register({
        id: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        name: 'Ground Coffee',
        barcode: '7891000000410',
        unitOfMeasure: 'UNIT',
        currentPrice: 14.17
      })
    );

    const event = createInventoryLossRegisteredEventFixture();

    await useCase.execute({ event });
    const response = await useCase.execute({ event });

    expect(response).toMatchObject({
      processingStatus: 'ignored',
      inventoryLossEntryId: null
    });
    expect(transactionRunner.inventoryLossEntryRepository.all()).toHaveLength(1);
  });

  it('fails when the management catalog cannot value the lost product', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new CaptureInventoryLossUseCase(transactionRunner);

    await expect(
      useCase.execute({
        event: createInventoryLossRegisteredEventFixture()
      })
    ).rejects.toBeInstanceOf(ResourceNotFoundError);
  });
});
