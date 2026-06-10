import { SalePaymentMethod } from '@supermarket/shared-domain';

import { DailyFinancialConsolidation } from '#/domain/entities/daily-financial-consolidation.entity';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';

describe('DailyFinancialConsolidation', () => {
  it('accumulates a financial entry into the daily totals', () => {
    const consolidation = DailyFinancialConsolidation.initialize({
      tenantId: 'df3aa79a-f7fb-4d9e-a7df-39fd2d96c39d',
      businessDate: '2026-06-09',
      createdAt: new Date('2026-06-09T00:00:00.000Z')
    });
    const entry = FinancialEntry.recordSaleRevenue({
      id: '5211ef52-0d62-4134-8b67-f1d8ab64ec88',
      tenantId: 'df3aa79a-f7fb-4d9e-a7df-39fd2d96c39d',
      sourceEventId: '3880d616-916d-44d2-87ff-bf8df4c14c73',
      saleId: '7d09cfdf-c8ce-463e-bff4-12f1c3951f9d',
      paymentMethod: SalePaymentMethod.Cash,
      businessDate: '2026-06-09',
      grossAmount: 36.9,
      totalItemsQuantity: 3,
      occurredAt: new Date('2026-06-09T18:30:00.000Z')
    });

    consolidation.applyFinancialEntry(entry, new Date('2026-06-09T18:30:01.000Z'));

    expect(consolidation.toPrimitives()).toMatchObject({
      grossSalesTotal: 36.9,
      salesCount: 1,
      soldItemsQuantity: 3
    });
  });
});
