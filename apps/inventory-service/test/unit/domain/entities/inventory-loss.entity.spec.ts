import { DomainValidationError, InventoryLossReason } from '@supermarket/shared-domain';

import { InventoryLoss } from '#/domain/entities/inventory-loss.entity';

describe('InventoryLoss', () => {
  it('records an inventory loss with normalized notes', () => {
    const loss = InventoryLoss.record({
      id: '0f9bb3c9-c1e7-4e6b-a33d-a9b2644c5d1b',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
      quantity: 2,
      reasonCode: InventoryLossReason.Damaged,
      notes: ' Bottle leaked ',
      occurredAt: new Date('2026-06-11T10:00:00.000Z')
    });

    expect(loss.toPrimitives()).toMatchObject({
      quantity: 2,
      reasonCode: InventoryLossReason.Damaged,
      notes: 'Bottle leaked'
    });
  });

  it('rejects invalid quantities', () => {
    expect(() =>
      InventoryLoss.record({
        id: '0f9bb3c9-c1e7-4e6b-a33d-a9b2644c5d1b',
        tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        quantity: 0,
        reasonCode: InventoryLossReason.Damaged,
        occurredAt: new Date('2026-06-11T10:00:00.000Z')
      })
    ).toThrow(new DomainValidationError('Inventory loss quantity must be a positive integer'));
  });
});
