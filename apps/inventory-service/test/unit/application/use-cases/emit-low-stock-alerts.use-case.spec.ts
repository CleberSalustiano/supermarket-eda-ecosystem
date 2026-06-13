import { EmitLowStockAlertsUseCase } from '#/application/use-cases/emit-low-stock-alerts.use-case';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import {
  FakeOutboxEventRelay,
  InMemoryInventoryItemRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryOutboxEventRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('EmitLowStockAlertsUseCase', () => {
  it('batches low stock items, stores alerts in the outbox, and updates the last alert marker', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      outboxEventRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new EmitLowStockAlertsUseCase(
      transactionRunner,
      {
        intervalMs: 300000,
        cooldownMinutes: 60,
        maxItemsPerBatch: 2
      },
      outboxEventRelay
    );

    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 1,
        minimumThreshold: 2,
        averageUnitCost: 7.7
      })
    );
    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000201',
        name: 'Whole Milk',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 0,
        minimumThreshold: 1,
        averageUnitCost: 6.2
      })
    );
    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '34d1df0b-041f-485c-b34d-4156d89021a5',
        tenantId: '87b9f60a-f5b9-4215-80da-2f7ccd5bb322',
        barcode: '7891000000202',
        name: 'Rice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 4,
        minimumThreshold: 5,
        averageUnitCost: 4.1
      })
    );

    const emittedAt = new Date('2026-06-13T12:00:00.000Z');
    const result = await useCase.execute({ emittedAt });

    expect(result.scannedCandidates).toBe(3);
    expect(result.emittedBatches).toHaveLength(2);
    expect(result.emittedBatches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
          itemsCount: 2,
          eventPublicationStatus: 'published'
        }),
        expect.objectContaining({
          tenantId: '87b9f60a-f5b9-4215-80da-2f7ccd5bb322',
          itemsCount: 1,
          eventPublicationStatus: 'published'
        })
      ])
    );
    expect(outboxEventRepository.all()).toHaveLength(2);
    expect(outboxEventRepository.all()[0]?.eventName).toBe('LowStockAlert');
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(2);
    expect(
      inventoryItemRepository.all().every((item) => item.toPrimitives().lastLowStockAlertAt !== null)
    ).toBe(true);
  });

  it('skips items that are still inside the low stock alert cooldown window', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const outboxEventRepository = new InMemoryOutboxEventRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      outboxEventRepository
    });
    const outboxEventRelay = new FakeOutboxEventRelay('published');
    const useCase = new EmitLowStockAlertsUseCase(
      transactionRunner,
      {
        intervalMs: 300000,
        cooldownMinutes: 60,
        maxItemsPerBatch: 10
      },
      outboxEventRelay
    );

    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 1,
        minimumThreshold: 2,
        averageUnitCost: 7.7,
        lastLowStockAlertAt: new Date('2026-06-13T11:30:00.000Z')
      })
    );

    const result = await useCase.execute({
      emittedAt: new Date('2026-06-13T12:00:00.000Z')
    });

    expect(result.scannedCandidates).toBe(0);
    expect(result.emittedBatches).toHaveLength(0);
    expect(outboxEventRepository.all()).toHaveLength(0);
    expect(outboxEventRelay.dispatchedEventIds).toHaveLength(0);
    expect(inventoryItemRepository.all()[0]?.toPrimitives().lastLowStockAlertAt).toBe(
      '2026-06-13T11:30:00.000Z'
    );
  });
});
