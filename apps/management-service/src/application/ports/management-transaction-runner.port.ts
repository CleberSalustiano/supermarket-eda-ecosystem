import type { EmployeeRepositoryPort } from '../../domain/repositories/employee.repository';
import type { ProductRepositoryPort } from '../../domain/repositories/product.repository';
import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';

export const MANAGEMENT_TRANSACTION_RUNNER = Symbol('MANAGEMENT_TRANSACTION_RUNNER');

export interface ManagementTransactionContext {
  employeeRepository: EmployeeRepositoryPort;
  outboxEventRepository: OutboxEventRepositoryPort;
  productRepository: ProductRepositoryPort;
}

export interface ManagementTransactionRunnerPort {
  execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T>;
}
