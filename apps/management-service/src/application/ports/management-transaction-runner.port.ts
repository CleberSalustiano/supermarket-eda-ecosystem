import type { DailyFinancialConsolidationRepositoryPort } from '#/domain/repositories/daily-financial-consolidation.repository';
import type { EmployeeRepositoryPort } from '#/domain/repositories/employee.repository';
import type { FinancialEntryRepositoryPort } from '#/domain/repositories/financial-entry.repository';
import type { ProductRepositoryPort } from '#/domain/repositories/product.repository';
import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';

export const MANAGEMENT_TRANSACTION_RUNNER = Symbol('MANAGEMENT_TRANSACTION_RUNNER');

export interface ManagementTransactionContext {
  dailyFinancialConsolidationRepository: DailyFinancialConsolidationRepositoryPort;
  employeeRepository: EmployeeRepositoryPort;
  financialEntryRepository: FinancialEntryRepositoryPort;
  outboxEventRepository: OutboxEventRepositoryPort;
  productRepository: ProductRepositoryPort;
}

export interface ManagementTransactionRunnerPort {
  execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T>;
}
