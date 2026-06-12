import type { FinancialEntry } from '#/domain/entities/financial-entry.entity';

export interface FinancialEntryBusinessDateSummary {
  businessDate: string;
  revenueNetTotal: number;
  netSalesCount: number;
  soldItemsQuantity: number;
}

export interface FinancialEntryRepositoryPort {
  saveIfAbsent(entry: FinancialEntry): Promise<boolean>;
  findSaleRevenueBySaleId(tenantId: string, saleId: string): Promise<FinancialEntry | null>;
  sumNetCashMovementBySession(tenantId: string, sessionId: string): Promise<number>;
  summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<FinancialEntryBusinessDateSummary[]>;
}
