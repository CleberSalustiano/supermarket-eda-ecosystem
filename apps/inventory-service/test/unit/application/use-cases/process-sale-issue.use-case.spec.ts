import { SALE_CANCELED_EVENT_NAME } from '@supermarket/shared-domain';

import { ProcessSaleIssueUseCase } from '#/application/use-cases/process-sale-issue.use-case';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import {
  createSaleCanceledEventFixture,
  createSaleCompletedEventFixture,
  InMemoryInventoryItemRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryProcessedEventRepository,
  InMemoryStockMovementRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('ProcessSaleIssueUseCase', () => {
  it('processes a sale completion event and records inventory movement once', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new ProcessSaleIssueUseCase(transactionRunner);

    const result = await useCase.execute({
      event: createSaleCompletedEventFixture()
    });

    expect(result).toMatchObject({
      processingStatus: 'processed',
      affectedItemsCount: 1,
      stockMovementCount: 1
    });
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: -3
    });
    expect(stockMovementRepository.all()).toHaveLength(1);
    expect(processedEventRepository.all()).toHaveLength(1);
  });

  it('updates an existing item and ignores a duplicate event id on replay', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new ProcessSaleIssueUseCase(transactionRunner);
    const event = createSaleCompletedEventFixture();

    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 10
      })
    );

    const firstResult = await useCase.execute({ event });
    const secondResult = await useCase.execute({ event });

    expect(firstResult.processingStatus).toBe('processed');
    expect(secondResult.processingStatus).toBe('ignored');
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: 7
    });
    expect(stockMovementRepository.all()).toHaveLength(1);
  });

  it('skips a sale completion when the sale was already canceled before the event arrives', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const processedEventRepository = new InMemoryProcessedEventRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      processedEventRepository,
      stockMovementRepository
    });
    const useCase = new ProcessSaleIssueUseCase(transactionRunner);
    const canceledEvent = createSaleCanceledEventFixture();
    const completedEvent = createSaleCompletedEventFixture();

    await processedEventRepository.save(
      ProcessedEvent.record({
        eventId: canceledEvent.eventId,
        eventName: SALE_CANCELED_EVENT_NAME,
        aggregateId: canceledEvent.aggregateId,
        tenantId: canceledEvent.tenantId,
        processedAt: new Date(canceledEvent.occurredAt)
      })
    );

    const result = await useCase.execute({ event: completedEvent });

    expect(result.processingStatus).toBe('skipped');
    expect(inventoryItemRepository.all()).toHaveLength(0);
    expect(stockMovementRepository.all()).toHaveLength(0);
    expect(processedEventRepository.all()).toHaveLength(2);
  });
});
