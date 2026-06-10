import {
  ConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  SalePaymentMethod
} from '@supermarket/shared-domain';

import { Sale } from '#/domain/entities/sale.entity';

describe('Sale', () => {
  it('adds items, merges the same product, and recalculates totals', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77',
      createdAt: new Date('2026-06-07T10:00:00.000Z')
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 2
    });
    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });

    expect(sale.toPrimitives()).toMatchObject({
      totalItemsQuantity: 3,
      subtotal: 29.7,
      total: 29.7,
      items: [
        {
          productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
          quantity: 3,
          lineTotal: 29.7
        }
      ]
    });
  });

  it('removes item quantities and drops the line when it becomes empty', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 2
    });

    sale.removeItem('7891000000200', 2);

    expect(sale.toPrimitives()).toMatchObject({
      totalItemsQuantity: 0,
      subtotal: 0,
      total: 0,
      items: []
    });
  });

  it('rejects removing more quantity than the cart contains', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });

    expect(() => sale.removeItem('7891000000200', 2)).toThrow(ConflictError);
  });

  it('rejects inconsistent persisted totals during rehydration', () => {
    expect(() =>
      Sale.rehydrate({
        id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
        tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
        sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77',
        status: 'OPEN',
        paymentMethod: null,
        paidAmount: null,
        changeAmount: null,
        paidAt: null,
        completedAt: null,
        totalItemsQuantity: 1,
        subtotal: 8,
        total: 8,
        items: [
          {
            productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
            barcode: '7891000000200',
            name: 'Orange Juice',
            unitOfMeasure: 'UNIT',
            unitPrice: 9.9,
            quantity: 1,
            lineTotal: 9.9
          }
        ],
        createdAt: new Date('2026-06-07T10:00:00.000Z'),
        updatedAt: new Date('2026-06-07T10:00:00.000Z')
      })
    ).toThrow(DomainValidationError);
  });

  it('returns not found when removing a barcode that is not in the cart', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    expect(() => sale.removeItem('7891000000200', 1)).toThrow(ResourceNotFoundError);
  });

  it('registers a cash payment and calculates change', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    sale.registerPayment({
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20
    });

    expect(sale.toPrimitives()).toMatchObject({
      status: 'PAID',
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20,
      changeAmount: 10.1
    });
  });

  it('rejects non-cash payments when the paid amount differs from the total', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });

    expect(() =>
      sale.registerPayment({
        paymentMethod: SalePaymentMethod.Pix,
        paidAmount: 10
      })
    ).toThrow(ConflictError);
  });

  it('completes a paid sale and freezes its completion timestamp', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    sale.registerPayment({
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20
    });
    sale.complete(new Date('2026-06-09T12:00:00.000Z'));

    expect(sale.toPrimitives()).toMatchObject({
      status: 'COMPLETED',
      completedAt: '2026-06-09T12:00:00.000Z'
    });
  });

  it('cancels an open sale without manager approval', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.cancel({
      reason: 'Customer gave up on the purchase',
      canceledAt: new Date('2026-06-09T12:10:00.000Z')
    });

    expect(sale.toPrimitives()).toMatchObject({
      status: 'CANCELED',
      cancellationReason: 'Customer gave up on the purchase',
      canceledAt: '2026-06-09T12:10:00.000Z'
    });
  });

  it('requires manager approval to cancel a paid sale', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    sale.addItem({
      productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
      barcode: '7891000000200',
      name: 'Orange Juice',
      unitOfMeasure: 'unit',
      unitPrice: 9.9,
      quantity: 1
    });
    sale.registerPayment({
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20
    });

    expect(() =>
      sale.cancel({
        reason: 'Card terminal rollback'
      })
    ).toThrow(ConflictError);
  });
});
