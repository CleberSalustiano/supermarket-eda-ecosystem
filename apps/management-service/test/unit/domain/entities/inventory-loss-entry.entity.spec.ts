import { InventoryLossReason } from '@supermarket/shared-domain';

import { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';

describe('InventoryLossEntry', () => {
  it('records a valued inventory loss entry from a processed integration event', () => {
    const entry = InventoryLossEntry.record({
      id: '1d128dd0-7a71-4eca-8f0b-a52f97257dd7',
      tenantId: '7a7e57f1-20ca-456a-8ab7-cfd82b3f41be',
      sourceEventId: '7b1736ac-2b32-45e7-89f6-290cb8bd3727',
      lossId: 'a8469ef8-d61a-4df3-8a1e-f9948a116b97',
      productId: '11f6bef0-9648-4a55-ab7d-8b0e7ff41ce1',
      barcode: '7891000000410',
      name: 'Ground Coffee',
      unitOfMeasure: 'unit',
      quantity: 2,
      reasonCode: InventoryLossReason.Damaged,
      notes: 'Broken package',
      businessDate: '2026-06-12',
      unitPrice: 14.17,
      occurredAt: new Date('2026-06-12T14:00:00.000Z')
    });

    expect(entry.toPrimitives()).toMatchObject({
      quantity: 2,
      reasonCode: InventoryLossReason.Damaged,
      unitPrice: 14.17,
      totalLossAmount: 28.34,
      notes: 'Broken package'
    });
  });

  it('normalizes blank notes to null', () => {
    const entry = InventoryLossEntry.record({
      id: '1d128dd0-7a71-4eca-8f0b-a52f97257dd7',
      tenantId: '7a7e57f1-20ca-456a-8ab7-cfd82b3f41be',
      sourceEventId: '7b1736ac-2b32-45e7-89f6-290cb8bd3727',
      lossId: 'a8469ef8-d61a-4df3-8a1e-f9948a116b97',
      productId: '11f6bef0-9648-4a55-ab7d-8b0e7ff41ce1',
      barcode: '7891000000410',
      name: 'Ground Coffee',
      unitOfMeasure: 'unit',
      quantity: 1,
      reasonCode: InventoryLossReason.Expired,
      notes: '   ',
      businessDate: '2026-06-12',
      unitPrice: 14.17,
      occurredAt: new Date('2026-06-12T14:00:00.000Z')
    });

    expect(entry.toPrimitives().notes).toBeNull();
  });
});
