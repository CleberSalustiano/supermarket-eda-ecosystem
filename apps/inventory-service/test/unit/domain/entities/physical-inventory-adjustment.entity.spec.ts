import { PhysicalInventoryAdjustment } from '#/domain/entities/physical-inventory-adjustment.entity';

describe('PhysicalInventoryAdjustment', () => {
  it('records a physical count adjustment with calculated delta', () => {
    const adjustment = PhysicalInventoryAdjustment.record({
      id: '95f76274-dfd0-4117-b397-4f93945f46ea',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      collectorId: '6e12f561-6714-4a95-a4c6-c65b4d0f5166',
      previousOnHandQuantity: 9,
      countedQuantity: 4,
      minimumThreshold: 5,
      reason: 'Cycle count correction',
      occurredAt: new Date('2026-06-13T09:00:00.000Z')
    });

    expect(adjustment.toPrimitives()).toMatchObject({
      previousOnHandQuantity: 9,
      countedQuantity: 4,
      quantityDelta: -5,
      minimumThreshold: 5,
      reason: 'Cycle count correction'
    });
  });
});
