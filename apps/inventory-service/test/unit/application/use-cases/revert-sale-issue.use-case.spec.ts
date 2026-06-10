import { SALE_COMPLETED_EVENT_NAME } from '@supermarket/shared-domain';

import type { RevertSaleIssueOutputDto } from '#/application/dto/revert-sale-issue.dto';
import { ProcessSaleIssueUseCase } from '#/application/use-cases/process-sale-issue.use-case';
import { RevertSaleIssueUseCase } from '#/application/use-cases/revert-sale-issue.use-case';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import {
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture,
  InMemoryInventoryItemRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryProcessedEventRepository,
  InMemoryStockMovementRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('RevertSaleIssueUseCase', () => {
  it('reverts a processed sale issue and records a positive stock movement', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const processSaleIssueUseCase = new ProcessSaleIssueUseCase(transactionRunner);
    const useCase = new RevertSaleIssueUseCase(transactionRunner);

    await processSaleIssueUseCase.execute({
      event: createSaleCompletedEventFixture()
    });

    const result = await useCase.execute({
      event: createSaleCanceledEventFixture()
    });

    expectProcessedResult(result);
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: 0
    });
    expect(stockMovementRepository.all()).toHaveLength(2);
    expect(stockMovementRepository.all()[1]?.toPrimitives()).toMatchObject({
      movementType: 'SALE_REVERSION',
      quantityDelta: 3
    });
    expect(processedEventRepository.all()).toHaveLength(2);
  });

  it('skips a cancellation when the sale issue has not been processed yet', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new RevertSaleIssueUseCase(transactionRunner);

    const result = await useCase.execute({
      event: createSaleCanceledEventFixture()
    });

    expect(result.processingStatus).toBe('skipped');
    expect(inventoryItemRepository.all()).toHaveLength(0);
    expect(stockMovementRepository.all()).toHaveLength(0);
    expect(processedEventRepository.all()).toHaveLength(1);
  });

  it('ignores a duplicate cancellation delivery after a successful reversion', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const processSaleIssueUseCase = new ProcessSaleIssueUseCase(transactionRunner);
    const useCase = new RevertSaleIssueUseCase(transactionRunner);
    const saleCompletedEvent = createSaleCompletedEventFixture();
    const saleCanceledEvent = createSaleCanceledEventFixture();

    await processSaleIssueUseCase.execute({
      event: saleCompletedEvent
    });

    const firstResult = await useCase.execute({ event: saleCanceledEvent });
    const secondResult = await useCase.execute({ event: saleCanceledEvent });

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('ignored');
    expect(stockMovementRepository.all()).toHaveLength(2);
  });

  it('skips a non-completed cancellation because no stock was deducted', async () => {
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new RevertSaleIssueUseCase(transactionRunner);

    const result = await useCase.execute({
      event: createSaleCanceledEventFixture({
        previousStatus: 'PAID'
      })
    });

    expect(result.processingStatus).toBe('skipped');
    expect(stockMovementRepository.all()).toHaveLength(0);
    expect(processedEventRepository.all()).toHaveLength(1);
  });

  it('skips a second sale cancellation event for the same sale even with a different event id', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new RevertSaleIssueUseCase(transactionRunner);
    const saleCompletedEvent = createSaleCompletedEventFixture();

    await inventoryItemRepository.save(
      InventoryItem.rehydrate({
        productId: saleCompletedEvent.payload.items[0]!.productId,
        tenantId: saleCompletedEvent.tenantId,
        barcode: saleCompletedEvent.payload.items[0]!.barcode,
        name: saleCompletedEvent.payload.items[0]!.name,
        unitOfMeasure: saleCompletedEvent.payload.items[0]!.unitOfMeasure,
        onHandQuantity: -3,
        minimumThreshold: 0,
        createdAt: new Date('2026-06-09T21:00:00.000Z'),
        updatedAt: new Date('2026-06-09T21:00:00.000Z')
      })
    );
    await processedEventRepository.save(
      ProcessedEvent.record({
        eventId: saleCompletedEvent.eventId,
        eventName: SALE_COMPLETED_EVENT_NAME,
        aggregateId: saleCompletedEvent.aggregateId,
        tenantId: saleCompletedEvent.tenantId,
        processedAt: new Date(saleCompletedEvent.occurredAt)
      })
    );

    const firstResult = await useCase.execute({
      event: createSaleCanceledEventFixture()
    });
    const secondResult = await useCase.execute({
      event: createSaleCanceledEventFixture({
        cancellationReason: 'Second duplicated cancellation'
      })
    });

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('skipped');
    expect(stockMovementRepository.all()).toHaveLength(1);
  });
});

function expectProcessedResult(result: RevertSaleIssueOutputDto): void {
  expect(result).toMatchObject({
    processingStatus: 'processed',
    affectedItemsCount: 1,
    stockMovementCount: 1
  });
}
