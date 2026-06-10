import { DomainValidationError, SalePaymentMethod } from '@supermarket/shared-domain';

import { FinancialEntry } from '#/domain/entities/financial-entry.entity';

describe('FinancialEntry', () => {
  it('records a sale revenue entry with immutable financial data', () => {
    const entry = FinancialEntry.recordSaleRevenue({
      id: 'a1108241-016d-4354-abf2-4a7343b27439',
      tenantId: 'd4f121bd-2fab-4899-86bb-72038f16b8cb',
      sourceEventId: 'f614f1d2-f680-4e60-ad36-c265f2eec907',
      saleId: 'b935b3d0-e0c5-42e2-84d2-32d22a1b171c',
      paymentMethod: SalePaymentMethod.Cash,
      businessDate: '2026-06-09',
      grossAmount: 55.4,
      totalItemsQuantity: 4,
      occurredAt: new Date('2026-06-09T21:40:00.000Z')
    });

    expect(entry.toPrimitives()).toMatchObject({
      entryType: 'SALE_REVENUE',
      businessDate: '2026-06-09',
      grossAmount: 55.4,
      totalItemsQuantity: 4
    });
    expect(entry.contributesGrossSales()).toBe(55.4);
    expect(entry.contributesItemsQuantity()).toBe(4);
  });

  it('rejects an invalid business date format', () => {
    expect(() =>
      FinancialEntry.recordSaleRevenue({
        id: '59882c36-4454-4472-a20b-8670a39f5e0a',
        tenantId: 'dd6122c7-7a25-4b49-8a50-9d7c300278cc',
        sourceEventId: '2d860a72-a902-49e5-ba90-849ae6f5ca15',
        saleId: '7b11cd16-9d71-45cc-a063-2c13b9bd8568',
        paymentMethod: SalePaymentMethod.Card,
        businessDate: '09/06/2026',
        grossAmount: 10,
        totalItemsQuantity: 1,
        occurredAt: new Date('2026-06-09T21:40:00.000Z')
      })
    ).toThrow(new DomainValidationError('Business date must use the YYYY-MM-DD format'));
  });
});
