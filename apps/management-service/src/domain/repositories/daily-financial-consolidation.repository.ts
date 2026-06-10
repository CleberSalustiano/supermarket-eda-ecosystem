import type { DailyFinancialConsolidation } from '#/domain/entities/daily-financial-consolidation.entity';

export interface DailyFinancialConsolidationRepositoryPort {
  accumulate(consolidation: DailyFinancialConsolidation): Promise<void>;
}
