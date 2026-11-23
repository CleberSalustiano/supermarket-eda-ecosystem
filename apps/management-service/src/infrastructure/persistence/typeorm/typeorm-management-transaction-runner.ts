import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type {
  ManagementTransactionContext,
  ManagementTransactionRunnerPort
} from '#/application/ports/management-transaction-runner.port';
import { TypeormApprovalThrottleRepository } from './repositories/typeorm-approval-throttle.repository';
import { TypeormCashReconciliationRepository } from './repositories/typeorm-cash-reconciliation.repository';
import { TypeormDailyFinancialConsolidationRepository } from './repositories/typeorm-daily-financial-consolidation.repository';
import { TypeormEmployeeAuditEntryRepository } from './repositories/typeorm-employee-audit-entry.repository';
import { TypeormEmployeeRepository } from './repositories/typeorm-employee.repository';
import { TypeormFinancialEntryRepository } from './repositories/typeorm-financial-entry.repository';
import { TypeormInventoryLossEntryRepository } from './repositories/typeorm-inventory-loss-entry.repository';
import { TypeormManagerApprovalAttemptRepository } from './repositories/typeorm-manager-approval-attempt.repository';
import { TypeormOutboxEventRepository } from './repositories/typeorm-outbox-event.repository';
import { TypeormProcessedEventRepository } from './repositories/typeorm-processed-event.repository';
import { TypeormProductRepository } from './repositories/typeorm-product.repository';

@Injectable()
export class TypeormManagementTransactionRunner implements ManagementTransactionRunnerPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        approvalThrottleRepository: new TypeormApprovalThrottleRepository(manager),
        cashReconciliationRepository: new TypeormCashReconciliationRepository(manager),
        dailyFinancialConsolidationRepository: new TypeormDailyFinancialConsolidationRepository(
          manager
        ),
        employeeAuditEntryRepository: new TypeormEmployeeAuditEntryRepository(manager),
        employeeRepository: new TypeormEmployeeRepository(manager),
        financialEntryRepository: new TypeormFinancialEntryRepository(manager),
        inventoryLossEntryRepository: new TypeormInventoryLossEntryRepository(manager),
        managerApprovalAttemptRepository: new TypeormManagerApprovalAttemptRepository(manager),
        outboxEventRepository: new TypeormOutboxEventRepository(manager),
        processedEventRepository: new TypeormProcessedEventRepository(manager),
        productRepository: new TypeormProductRepository(manager)
      })
    );
  }
}
