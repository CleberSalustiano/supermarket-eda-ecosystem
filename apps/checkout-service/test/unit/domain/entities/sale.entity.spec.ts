import {
  ConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  SalePaymentMethod
} from '@supermarket/shared-domain';

import { Sale } from '#/domain/entities/sale.entity';
import { ManagerApproval } from '#/domain/value-objects/manager-approval';

const approver = {
  employeeId: '7f0b1b9e-3c55-4b8a-9d55-1f6f7d2b9a01',
  employeeCode: 'MANAGER-01',
  fullName: 'Bruno Lima'
};

function createPaidSale(): Sale {
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
    paidAmount: 20,
    paidAt: new Date('2026-06-09T12:00:00.000Z')
  });

  return sale;
}

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
        canceledAt: null,
        cancellationReason: null,
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
  it('cancels a paid sale with a manager approval and stores the approver', () => {
    const sale = createPaidSale();

    expect(sale.requiresManagerApprovalToCancel()).toBe(true);

    sale.cancel({
      reason: 'Card terminal rollback',
      approval: ManagerApproval.create(approver),
      canceledAt: new Date('2026-06-09T12:10:00.000Z')
    });

    expect(sale.toPrimitives()).toMatchObject({
      status: 'CANCELED',
      cancellationReason: 'Card terminal rollback',
      cancellationApproval: approver,
      paymentMethod: SalePaymentMethod.Cash
    });
  });

  it('cancels a completed sale with a manager approval', () => {
    const sale = createPaidSale();

    sale.complete(new Date('2026-06-09T12:05:00.000Z'));

    expect(sale.requiresManagerApprovalToCancel()).toBe(true);

    sale.cancel({ reason: 'Wrong product', approval: ManagerApproval.create(approver) });

    expect(sale.toPrimitives()).toMatchObject({
      status: 'CANCELED',
      cancellationApproval: approver
    });
  });

  it('ignores an approval when canceling an open sale', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    expect(sale.requiresManagerApprovalToCancel()).toBe(false);

    sale.cancel({ reason: 'Customer gave up', approval: ManagerApproval.create(approver) });

    expect(sale.toPrimitives()).toMatchObject({
      status: 'CANCELED',
      cancellationApproval: null
    });
  });

  it('checks cancelability without changing the sale', () => {
    const sale = createPaidSale();

    expect(() => sale.assertCancelable({ approvalProvided: false })).toThrow(
      'requires manager approval before cancellation after payment'
    );
    expect(() => sale.assertCancelable({ approvalProvided: true })).not.toThrow();
    expect(sale.toPrimitives().status).toBe('PAID');
  });

  it('rejects canceling an already canceled sale even with an approval', () => {
    const sale = createPaidSale();

    sale.cancel({ reason: 'First', approval: ManagerApproval.create(approver) });

    expect(sale.requiresManagerApprovalToCancel()).toBe(false);
    expect(() => sale.assertCancelable({ approvalProvided: true })).toThrow(ConflictError);
    expect(() =>
      sale.cancel({ reason: 'Second', approval: ManagerApproval.create(approver) })
    ).toThrow(ConflictError);
  });

  it('starts sales without a cancellation approval', () => {
    const sale = Sale.start({
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77'
    });

    expect(sale.toPrimitives().cancellationApproval).toBeNull();
  });

  describe('rehydration of the cancellation approval', () => {
    const paidCanceledSale = {
      id: 'f0fa0542-f983-4f22-b205-fde4fcb0692b',
      tenantId: '0a8e7bc5-bbf4-4757-8df9-c391c77b5436',
      sessionId: '26f1f89d-61fe-4c4f-bd12-e5fcfb1d0d77',
      status: 'CANCELED' as const,
      paymentMethod: SalePaymentMethod.Cash,
      paidAmount: 20,
      changeAmount: 10.1,
      paidAt: new Date('2026-06-09T12:00:00.000Z'),
      completedAt: null,
      canceledAt: new Date('2026-06-09T12:10:00.000Z'),
      cancellationReason: 'Card terminal rollback',
      totalItemsQuantity: 1,
      subtotal: 9.9,
      total: 9.9,
      items: [
        {
          productId: 'ef198011-97e6-405a-97d6-4e8166f2138e',
          barcode: '7891000000200',
          name: 'Orange Juice',
          unitOfMeasure: 'unit',
          unitPrice: 9.9,
          quantity: 1,
          lineTotal: 9.9
        }
      ],
      createdAt: new Date('2026-06-09T11:50:00.000Z'),
      updatedAt: new Date('2026-06-09T12:10:00.000Z')
    };

    it('restores the approver of a paid canceled sale', () => {
      const sale = Sale.rehydrate({ ...paidCanceledSale, cancellationApproval: approver });

      expect(sale.toPrimitives().cancellationApproval).toEqual(approver);
    });

    it('accepts a legacy paid canceled sale without an approver', () => {
      const sale = Sale.rehydrate({ ...paidCanceledSale });

      expect(sale.toPrimitives().cancellationApproval).toBeNull();
    });

    it('rejects an approver on a canceled sale that was never paid', () => {
      expect(() =>
        Sale.rehydrate({
          ...paidCanceledSale,
          paymentMethod: null,
          paidAmount: null,
          changeAmount: null,
          paidAt: null,
          cancellationApproval: approver
        })
      ).toThrow(DomainValidationError);
    });

    it('rejects an approver on a sale that is not canceled', () => {
      expect(() =>
        Sale.rehydrate({
          ...paidCanceledSale,
          status: 'PAID',
          canceledAt: null,
          cancellationReason: null,
          cancellationApproval: approver
        })
      ).toThrow(DomainValidationError);
    });

    it('rejects an approver with a blank field', () => {
      expect(() =>
        Sale.rehydrate({
          ...paidCanceledSale,
          cancellationApproval: { ...approver, fullName: ' ' }
        })
      ).toThrow(DomainValidationError);
    });
  });
});
