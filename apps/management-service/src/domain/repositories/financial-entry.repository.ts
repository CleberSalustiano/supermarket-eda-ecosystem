import type { FinancialEntry } from '#/domain/entities/financial-entry.entity';

export interface FinancialEntryRepositoryPort {
  saveIfAbsent(entry: FinancialEntry): Promise<boolean>;
}
