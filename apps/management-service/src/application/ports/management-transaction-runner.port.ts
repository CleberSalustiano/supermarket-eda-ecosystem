import type { ApprovalThrottleRepositoryPort } from '#/domain/repositories/approval-throttle.repository';
import type { CashReconciliationRepositoryPort } from '#/domain/repositories/cash-reconciliation.repository';
import type { DailyFinancialConsolidationRepositoryPort } from '#/domain/repositories/daily-financial-consolidation.repository';
import type { EmployeeAuditEntryRepositoryPort } from '#/domain/repositories/employee-audit-entry.repository';
import type { EmployeeRepositoryPort } from '#/domain/repositories/employee.repository';
import type { FinancialEntryRepositoryPort } from '#/domain/repositories/financial-entry.repository';
import type { InventoryLossEntryRepositoryPort } from '#/domain/repositories/inventory-loss-entry.repository';
import type { ManagerApprovalAttemptRepositoryPort } from '#/domain/repositories/manager-approval-attempt.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { ProductRepositoryPort } from '#/domain/repositories/product.repository';
import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';

export const MANAGEMENT_TRANSACTION_RUNNER = Symbol('MANAGEMENT_TRANSACTION_RUNNER');

export interface ManagementTransactionContext {
  approvalThrottleRepository: ApprovalThrottleRepositoryPort;
  cashReconciliationRepository: CashReconciliationRepositoryPort;
  dailyFinancialConsolidationRepository: DailyFinancialConsolidationRepositoryPort;
  employeeAuditEntryRepository: EmployeeAuditEntryRepositoryPort;
  employeeRepository: EmployeeRepositoryPort;
  financialEntryRepository: FinancialEntryRepositoryPort;
  inventoryLossEntryRepository: InventoryLossEntryRepositoryPort;
  managerApprovalAttemptRepository: ManagerApprovalAttemptRepositoryPort;
  outboxEventRepository: OutboxEventRepositoryPort;
  processedEventRepository: ProcessedEventRepositoryPort;
  productRepository: ProductRepositoryPort;
}

export interface ManagementTransactionRunnerPort {
  execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T>;
}
