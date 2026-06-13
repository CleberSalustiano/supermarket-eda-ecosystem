import { InventoryItem } from '#/domain/entities/inventory-item.entity';

describe('InventoryItem', () => {
  it('initializes a valid inventory item with normalized product data', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: ' 7891000000200 ',
      name: ' Orange Juice ',
      unitOfMeasure: 'unit',
      onHandQuantity: 5,
      minimumThreshold: 1
    });

    expect(item.toPrimitives()).toMatchObject({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      onHandQuantity: 5,
      minimumThreshold: 1,
      averageUnitCost: null
    });
  });

  it('receives stock and calculates the average unit cost', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      onHandQuantity: 10,
      averageUnitCost: 8.4
    });

    item.receiveStock({
      barcode: '7891000000201',
      name: 'Orange Juice Premium',
      unitOfMeasure: 'box',
      quantity: 5,
      unitCost: 9.6
    });

    expect(item.toPrimitives()).toMatchObject({
      barcode: '7891000000201',
      name: 'Orange Juice Premium',
      unitOfMeasure: 'BOX',
      onHandQuantity: 15,
      averageUnitCost: 8.8,
      lastLowStockAlertAt: null
    });
  });

  it('applies a physical count, updates threshold, and returns the absolute quantity delta', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      onHandQuantity: 9,
      minimumThreshold: 2,
      averageUnitCost: 7.7,
      lastLowStockAlertAt: new Date('2026-06-12T08:00:00.000Z')
    });

    const quantityDelta = item.applyPhysicalCount({
      barcode: '7891000000202',
      name: 'Orange Juice Counted',
      unitOfMeasure: 'box',
      countedQuantity: 4,
      minimumThreshold: 5
    });

    expect(quantityDelta).toBe(-5);
    expect(item.toPrimitives()).toMatchObject({
      barcode: '7891000000202',
      name: 'Orange Juice Counted',
      unitOfMeasure: 'BOX',
      onHandQuantity: 4,
      minimumThreshold: 5,
      averageUnitCost: 7.7
    });
    expect(item.shouldEmitLowStockAlert(new Date('2026-06-12T07:59:59.000Z'))).toBe(false);
    expect(item.shouldEmitLowStockAlert(new Date('2026-06-12T08:00:00.000Z'))).toBe(true);
  });

  it('issues a sale and allows stock to go negative for traceability', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      onHandQuantity: 1
    });

    item.issueSale({
      barcode: '7891000000200',
      name: 'Orange Juice Premium',
      unitOfMeasure: 'unit',
      quantity: 3
    });

    expect(item.toPrimitives()).toMatchObject({
      name: 'Orange Juice Premium',
      unitOfMeasure: 'UNIT',
      onHandQuantity: -2
    });
  });

  it('reverts a sale issue and restores product stock metadata consistently', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      onHandQuantity: 0
    });

    item.issueSale({
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      quantity: 2
    });

    item.revertSaleIssue({
      barcode: '7891000000201',
      name: 'Orange Juice Returned',
      unitOfMeasure: 'box',
      quantity: 2
    });

    expect(item.toPrimitives()).toMatchObject({
      barcode: '7891000000201',
      name: 'Orange Juice Returned',
      unitOfMeasure: 'BOX',
      onHandQuantity: 0
    });
  });

  it('registers an inventory loss and allows stock to go negative for traceability', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      onHandQuantity: 1
    });

    item.registerLoss({
      barcode: '7891000000201',
      name: 'Orange Juice Damaged',
      unitOfMeasure: 'box',
      quantity: 3
    });

    expect(item.toPrimitives()).toMatchObject({
      barcode: '7891000000201',
      name: 'Orange Juice Damaged',
      unitOfMeasure: 'BOX',
      onHandQuantity: -2,
      averageUnitCost: null
    });
  });

  it('marks low stock alerts and clears the marker once stock recovers above threshold', () => {
    const item = InventoryItem.initialize({
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      onHandQuantity: 1,
      minimumThreshold: 2
    });
    const emittedAt = new Date('2026-06-13T09:00:00.000Z');

    item.markLowStockAlertEmitted(emittedAt);

    expect(item.toPrimitives().lastLowStockAlertAt).toBe(emittedAt.toISOString());
    expect(item.shouldEmitLowStockAlert(new Date('2026-06-13T08:30:00.000Z'))).toBe(false);

    item.receiveStock({
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'UNIT',
      quantity: 5,
      unitCost: 7.7
    });

    expect(item.toPrimitives().lastLowStockAlertAt).toBeNull();
  });
});
