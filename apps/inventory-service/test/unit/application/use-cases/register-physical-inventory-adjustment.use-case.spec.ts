import { RegisterPhysicalInventoryAdjustmentUseCase } from '#/application/use-cases/register-physical-inventory-adjustment.use-case';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import {
  InMemoryInventoryItemRepository,
  InMemoryInventoryTransactionRunner,
  InMemoryPhysicalInventoryAdjustmentRepository,
  InMemoryStockMovementRepository
} from '../../../support/in-memory-inventory-test-doubles';

describe('RegisterPhysicalInventoryAdjustmentUseCase', () => {
  it('registers a physical adjustment, updates stock, and records the audit trail', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const physicalInventoryAdjustmentRepository =
      new InMemoryPhysicalInventoryAdjustmentRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      physicalInventoryAdjustmentRepository,
      stockMovementRepository
    });
    const useCase = new RegisterPhysicalInventoryAdjustmentUseCase(transactionRunner);

    const result = await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      countedQuantity: 4,
      minimumThreshold: 5,
      reason: 'Cycle count correction',
      collectorId: '6e12f561-6714-4a95-a4c6-c65b4d0f5166'
    });

    expect(result).toMatchObject({
      quantityDelta: 4,
      onHandQuantity: 4,
      minimumThreshold: 5
    });
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      onHandQuantity: 4,
      minimumThreshold: 5
    });
    expect(physicalInventoryAdjustmentRepository.all()).toHaveLength(1);
    expect(stockMovementRepository.all()).toHaveLength(1);
    expect(stockMovementRepository.all()[0]?.toPrimitives().movementType).toBe(
      'PHYSICAL_ADJUSTMENT'
    );
  });

  it('recounts an existing item, returning a negative delta when the counted quantity is lower', async () => {
    const inventoryItemRepository = new InMemoryInventoryItemRepository();
    const physicalInventoryAdjustmentRepository =
      new InMemoryPhysicalInventoryAdjustmentRepository();
    const stockMovementRepository = new InMemoryStockMovementRepository();
    const transactionRunner = new InMemoryInventoryTransactionRunner({
      inventoryItemRepository,
      physicalInventoryAdjustmentRepository,
      stockMovementRepository
    });
    const useCase = new RegisterPhysicalInventoryAdjustmentUseCase(transactionRunner);

    await inventoryItemRepository.save(
      InventoryItem.initialize({
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        onHandQuantity: 9,
        minimumThreshold: 2,
        averageUnitCost: 7.7
      })
    );

    const result = await useCase.execute({
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      barcode: '7891000000201',
      name: 'Orange Juice Counted',
      unitOfMeasure: 'box',
      countedQuantity: 4,
      minimumThreshold: 5,
      reason: 'Cycle count correction',
      collectorId: '6e12f561-6714-4a95-a4c6-c65b4d0f5166',
      occurredAt: '2026-06-13T09:00:00.000Z'
    });

    expect(result).toMatchObject({
      quantityDelta: -5,
      onHandQuantity: 4,
      minimumThreshold: 5
    });
    expect(inventoryItemRepository.all()[0]?.toPrimitives()).toMatchObject({
      barcode: '7891000000201',
      name: 'Orange Juice Counted',
      unitOfMeasure: 'BOX',
      onHandQuantity: 4,
      minimumThreshold: 5
    });
    expect(physicalInventoryAdjustmentRepository.all()[0]?.toPrimitives()).toMatchObject({
      previousOnHandQuantity: 9,
      countedQuantity: 4,
      quantityDelta: -5
    });
    expect(stockMovementRepository.all()[0]?.toPrimitives()).toMatchObject({
      movementType: 'PHYSICAL_ADJUSTMENT',
      quantityDelta: -5
    });
  });
});
