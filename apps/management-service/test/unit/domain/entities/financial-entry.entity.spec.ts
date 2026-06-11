import { DomainValidationError, SalePaymentMethod } from '@supermarket/shared-domain';

import { FinancialEntry } from '#/domain/entities/financial-entry.entity';

describe('FinancialEntry', () => {
  it('records a sale revenue entry with immutable financial data', () => {
    const entry = FinancialEntry.recordSaleRevenue({
      id: 'a1108241-016d-4354-abf2-4a7343b27439',
      tenantId: 'd4f121bd-2fab-4899-86bb-72038f16b8cb',
      sourceEventId: 'f614f1d2-f680-4e60-ad36-c265f2eec907',
      saleId: 'b935b3d0-e0c5-42e2-84d2-32d22a1b171c',
      sessionId: 'bf5ae0eb-5ca1-441f-b3bb-1dce8f73b8df',
      registerId: 'register-01',
      operatorId: '57c145c4-b316-4433-b3a4-8c4cbfc81e0b',
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
    expect(entry.contributesSalesCount()).toBe(1);
    expect(entry.contributesNetCash()).toBe(55.4);
  });

  it('rejects an invalid business date format', () => {
    expect(() =>
      FinancialEntry.recordSaleRevenue({
        id: '59882c36-4454-4472-a20b-8670a39f5e0a',
        tenantId: 'dd6122c7-7a25-4b49-8a50-9d7c300278cc',
        sourceEventId: '2d860a72-a902-49e5-ba90-849ae6f5ca15',
        saleId: '7b11cd16-9d71-45cc-a063-2c13b9bd8568',
        sessionId: '7e6808dc-3003-41c4-a5fa-e4dca42214af',
        registerId: 'register-02',
        operatorId: '56f72446-fde2-444f-a5b4-c6d7d4885e3e',
        paymentMethod: SalePaymentMethod.Card,
        businessDate: '09/06/2026',
        grossAmount: 10,
        totalItemsQuantity: 1,
        occurredAt: new Date('2026-06-09T21:40:00.000Z')
      })
    ).toThrow(new DomainValidationError('Business date must use the YYYY-MM-DD format'));
  });

  it('records a sale cancellation reversal with negative contributions for projections', () => {
    const entry = FinancialEntry.recordSaleCancellationReversal({
      id: 'f0ef4d0d-b3f8-4dbd-a7c9-390c9495b341',
      tenantId: 'd4f121bd-2fab-4899-86bb-72038f16b8cb',
      sourceEventId: '37bdc938-7f9e-4e12-a2f8-b46623fb1944',
      saleId: 'b935b3d0-e0c5-42e2-84d2-32d22a1b171c',
      sessionId: 'bf5ae0eb-5ca1-441f-b3bb-1dce8f73b8df',
      registerId: 'register-01',
      operatorId: '57c145c4-b316-4433-b3a4-8c4cbfc81e0b',
      paymentMethod: SalePaymentMethod.Cash,
      businessDate: '2026-06-09',
      grossAmount: 55.4,
      totalItemsQuantity: 4,
      occurredAt: new Date('2026-06-09T22:00:00.000Z')
    });

    expect(entry.toPrimitives()).toMatchObject({
      entryType: 'SALE_CANCELLATION_REVERSAL',
      grossAmount: 55.4
    });
    expect(entry.contributesGrossSales()).toBe(-55.4);
    expect(entry.contributesItemsQuantity()).toBe(-4);
    expect(entry.contributesSalesCount()).toBe(-1);
    expect(entry.contributesNetCash()).toBe(-55.4);
  });
});
