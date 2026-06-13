import { GenerateProfitAndLossReportUseCase } from '#/application/use-cases/generate-profit-and-loss-report.use-case';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';
import { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';
import { SalePaymentMethod, InventoryLossReason } from '@supermarket/shared-domain';
import { InMemoryManagementTransactionRunner } from '../../../support/in-memory-management-test-doubles';

describe('GenerateProfitAndLossReportUseCase', () => {
  it('merges revenue and loss ledgers by business date and computes the net result', async () => {
    const transactionRunner = new InMemoryManagementTransactionRunner();
    const useCase = new GenerateProfitAndLossReportUseCase(transactionRunner);

    await transactionRunner.financialEntryRepository.saveIfAbsent(
      FinancialEntry.recordSaleRevenue({
        id: '8b9dfe36-1331-4f8a-9638-a6f14a69ce97',
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        sourceEventId: '0cf140d2-7015-4bb7-95e1-7f7197443c6e',
        saleId: '4f8b4732-4712-48fe-8d48-588fc8770f89',
        sessionId: 'a2d4f919-f850-4ebb-b0df-c1f0e50eb2c9',
        registerId: 'register-01',
        operatorId: '8f9ec974-ac6a-46b0-b5c2-965b39844cfb',
        paymentMethod: SalePaymentMethod.Cash,
        businessDate: '2026-06-09',
        grossAmount: 42.5,
        totalItemsQuantity: 3,
        occurredAt: new Date('2026-06-09T22:15:00.000Z')
      })
    );
    await transactionRunner.financialEntryRepository.saveIfAbsent(
      FinancialEntry.recordSaleCancellationReversal({
        id: '74c0f21f-9392-4378-81dd-4b04fb0ff35f',
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        sourceEventId: '00d7c8d8-6bf3-4ad9-92cc-c25eb9e6f77a',
        saleId: '5d33f877-30ff-4ced-b937-c8ee30a64c43',
        sessionId: 'a2d4f919-f850-4ebb-b0df-c1f0e50eb2c9',
        registerId: 'register-01',
        operatorId: '8f9ec974-ac6a-46b0-b5c2-965b39844cfb',
        paymentMethod: SalePaymentMethod.Card,
        businessDate: '2026-06-09',
        grossAmount: 10,
        totalItemsQuantity: 1,
        occurredAt: new Date('2026-06-09T23:00:00.000Z')
      })
    );
    await transactionRunner.inventoryLossEntryRepository.saveIfAbsent(
      InventoryLossEntry.record({
        id: 'e21ea610-1550-4a33-ad28-7edb45f6b658',
        tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
        sourceEventId: 'd9b53299-f15e-4623-9650-78ff8a0a0b1a',
        lossId: 'eae5e0e9-52c1-4e68-bf38-077d059d2a07',
        productId: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
        barcode: '7891000000410',
        name: 'Ground Coffee',
        unitOfMeasure: 'UNIT',
        quantity: 2,
        reasonCode: InventoryLossReason.Damaged,
        notes: 'Broken package',
        businessDate: '2026-06-09',
        unitPrice: 14.17,
        occurredAt: new Date('2026-06-09T23:10:00.000Z')
      })
    );

    const response = await useCase.execute({
      tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
      fromDate: '2026-06-09',
      toDate: '2026-06-10'
    });

    expect(response).toMatchObject({
      revenueNetTotal: 32.5,
      inventoryLossTotal: 28.34,
      profitAndLossTotal: 4.16,
      netSalesCount: 0,
      soldItemsQuantity: 2,
      lossEventsCount: 1,
      lossItemsQuantity: 2
    });
    expect(response.days).toEqual([
      {
        businessDate: '2026-06-09',
        revenueNetTotal: 32.5,
        inventoryLossTotal: 28.34,
        profitAndLossTotal: 4.16,
        netSalesCount: 0,
        soldItemsQuantity: 2,
        lossEventsCount: 1,
        lossItemsQuantity: 2
      },
      {
        businessDate: '2026-06-10',
        revenueNetTotal: 0,
        inventoryLossTotal: 0,
        profitAndLossTotal: 0,
        netSalesCount: 0,
        soldItemsQuantity: 0,
        lossEventsCount: 0,
        lossItemsQuantity: 0
      }
    ]);
  });
});
