import { InventoryLossReason } from '@supermarket/shared-domain';

import { StockMovement } from '#/domain/entities/stock-movement.entity';

describe('StockMovement', () => {
  it('records a negative stock movement for a completed sale issue', () => {
    const movement = StockMovement.recordSaleIssue({
      id: 'b52df24f-f0c3-4aea-bbb6-8b3d91c6f08d',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantity: 3,
      referenceId: 'a34e2d05-c42a-48ea-b982-e0132aa86012',
      referenceEventId: 'de8bb4ee-a58d-47f1-ac9a-762c6dfa619b',
      occurredAt: new Date('2026-06-09T21:00:00.000Z')
    });

    expect(movement.toPrimitives()).toMatchObject({
      movementType: 'SALE_ISSUE',
      quantityDelta: -3,
      reason: 'Sale completed stock issue'
    });
  });

  it('records a positive stock movement for a sale cancellation reversion', () => {
    const movement = StockMovement.recordSaleReversion({
      id: '7b7bd3e4-bdda-4f01-a015-d43d23416584',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantity: 3,
      referenceId: 'a34e2d05-c42a-48ea-b982-e0132aa86012',
      referenceEventId: 'fb728de1-d0a2-4e9b-bd4f-3a8d7fcd4c68',
      occurredAt: new Date('2026-06-09T21:05:00.000Z')
    });

    expect(movement.toPrimitives()).toMatchObject({
      movementType: 'SALE_REVERSION',
      quantityDelta: 3,
      reason: 'Sale cancellation stock reversion'
    });
  });

  it('records a negative stock movement for an inventory loss', () => {
    const movement = StockMovement.recordLoss({
      id: '7b7bd3e4-bdda-4f01-a015-d43d23416584',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantity: 2,
      referenceId: 'a34e2d05-c42a-48ea-b982-e0132aa86012',
      referenceEventId: 'fb728de1-d0a2-4e9b-bd4f-3a8d7fcd4c68',
      reasonCode: InventoryLossReason.Damaged,
      occurredAt: new Date('2026-06-11T10:00:00.000Z')
    });

    expect(movement.toPrimitives()).toMatchObject({
      movementType: 'LOSS',
      quantityDelta: -2,
      reason: 'Inventory loss registered: DAMAGED'
    });
  });

  it('records a positive stock movement for supplier invoice receipt', () => {
    const movement = StockMovement.recordReceipt({
      id: 'd890a51e-9880-447a-bd5a-6e1ae8c16ce6',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantity: 5,
      referenceId: 'fced6817-46dd-4fe0-abf8-85431a51646d',
      referenceEventId: '165196eb-f1ff-48df-8b25-17f126a86af3',
      supplierReference: 'nf-12345',
      occurredAt: new Date('2026-06-12T09:00:00.000Z')
    });

    expect(movement.toPrimitives()).toMatchObject({
      movementType: 'RECEIPT',
      quantityDelta: 5,
      reason: 'Supplier invoice received: NF-12345'
    });
  });

  it('records a positive or negative stock movement for a physical inventory adjustment', () => {
    const movement = StockMovement.recordPhysicalAdjustment({
      id: 'e4fd3612-dcce-4a84-aee9-493784d8735b',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantityDelta: -4,
      referenceId: '1b9ef557-bc03-4b8d-a5be-3499f5e5c73c',
      referenceEventId: '1b9ef557-bc03-4b8d-a5be-3499f5e5c73c',
      occurredAt: new Date('2026-06-13T09:00:00.000Z')
    });

    expect(movement.toPrimitives()).toMatchObject({
      movementType: 'PHYSICAL_ADJUSTMENT',
      quantityDelta: -4,
      reason: 'Physical inventory adjustment'
    });
  });
});
