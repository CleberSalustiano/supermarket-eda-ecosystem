import { SupplierInvoice } from '#/domain/entities/supplier-invoice.entity';

describe('SupplierInvoice', () => {
  it('registers a supplier invoice with normalized reference and aggregated totals', () => {
    const invoice = SupplierInvoice.register({
      id: '5bcf5f37-7880-490f-aeff-835998d6c735',
      tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
      supplierReference: ' nf-12345 ',
      receivedAt: new Date('2026-06-12T09:00:00.000Z'),
      items: [
        {
          id: '822f894c-ec0b-475f-87c6-b99a6f7425eb',
          productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
          barcode: '7891000000200',
          name: 'Orange Juice',
          unitOfMeasure: 'unit',
          quantity: 5,
          unitCost: 7.7
        },
        {
          id: 'fcb58b12-9fdf-40e5-9266-2be66a1ce2d3',
          productId: '8021d70d-bbbd-46c9-8d2b-9ebfe13c5424',
          barcode: '7891000000201',
          name: 'Whole Milk',
          unitOfMeasure: 'unit',
          quantity: 3,
          unitCost: 6.2
        }
      ]
    });

    expect(invoice.toPrimitives()).toMatchObject({
      supplierReference: 'NF-12345',
      totalItemsQuantity: 8,
      totalCost: 57.1
    });
  });
});
