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
      minimumThreshold: 1
    });
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
});
