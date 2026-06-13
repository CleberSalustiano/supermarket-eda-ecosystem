import type { CashReconciliationRepositoryPort } from '#/domain/repositories/cash-reconciliation.repository';
import type { DailyFinancialConsolidationRepositoryPort } from '#/domain/repositories/daily-financial-consolidation.repository';
import type { EmployeeRepositoryPort } from '#/domain/repositories/employee.repository';
import type { FinancialEntryRepositoryPort } from '#/domain/repositories/financial-entry.repository';
import type { InventoryLossEntryRepositoryPort } from '#/domain/repositories/inventory-loss-entry.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { ProductRepositoryPort } from '#/domain/repositories/product.repository';
import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';

export const MANAGEMENT_TRANSACTION_RUNNER = Symbol('MANAGEMENT_TRANSACTION_RUNNER');

export interface ManagementTransactionContext {
  cashReconciliationRepository: CashReconciliationRepositoryPort;
  dailyFinancialConsolidationRepository: DailyFinancialConsolidationRepositoryPort;
  employeeRepository: EmployeeRepositoryPort;
  financialEntryRepository: FinancialEntryRepositoryPort;
  inventoryLossEntryRepository: InventoryLossEntryRepositoryPort;
  outboxEventRepository: OutboxEventRepositoryPort;
  processedEventRepository: ProcessedEventRepositoryPort;
  productRepository: ProductRepositoryPort;
}

export interface ManagementTransactionRunnerPort {
  execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T>;
}
