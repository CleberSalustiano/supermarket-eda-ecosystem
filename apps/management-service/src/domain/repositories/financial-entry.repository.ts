import type { FinancialEntry } from '#/domain/entities/financial-entry.entity';

export interface FinancialEntryRepositoryPort {
  saveIfAbsent(entry: FinancialEntry): Promise<boolean>;
  findSaleRevenueBySaleId(tenantId: string, saleId: string): Promise<FinancialEntry | null>;
  sumNetCashMovementBySession(tenantId: string, sessionId: string): Promise<number>;
}
