import { CashReconciliationTypeormEntity } from './cash-reconciliation.typeorm-entity';
import { DailyFinancialConsolidationTypeormEntity } from './daily-financial-consolidation.typeorm-entity';
import { EmployeeTypeormEntity } from './employee.typeorm-entity';
import { FinancialEntryTypeormEntity } from './financial-entry.typeorm-entity';
import { InventoryLossEntryTypeormEntity } from './inventory-loss-entry.typeorm-entity';
import { OutboxEventTypeormEntity } from './outbox-event.typeorm-entity';
import { ProcessedEventTypeormEntity } from './processed-event.typeorm-entity';
import { ProductTypeormEntity } from './product.typeorm-entity';

export const managementTypeormEntities = [
  ProductTypeormEntity,
  EmployeeTypeormEntity,
  OutboxEventTypeormEntity,
  FinancialEntryTypeormEntity,
  InventoryLossEntryTypeormEntity,
  DailyFinancialConsolidationTypeormEntity,
  CashReconciliationTypeormEntity,
  ProcessedEventTypeormEntity
] as const;
