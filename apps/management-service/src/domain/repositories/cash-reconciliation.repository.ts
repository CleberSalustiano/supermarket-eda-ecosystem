import type { CashReconciliation } from '#/domain/entities/cash-reconciliation.entity';

export interface CashReconciliationRepositoryPort {
  saveIfAbsent(reconciliation: CashReconciliation): Promise<boolean>;
}
