import { DailyFinancialConsolidationTypeormEntity } from './daily-financial-consolidation.typeorm-entity';
import { EmployeeTypeormEntity } from './employee.typeorm-entity';
import { FinancialEntryTypeormEntity } from './financial-entry.typeorm-entity';
import { OutboxEventTypeormEntity } from './outbox-event.typeorm-entity';
import { ProductTypeormEntity } from './product.typeorm-entity';

export const managementTypeormEntities = [
  ProductTypeormEntity,
  EmployeeTypeormEntity,
  OutboxEventTypeormEntity,
  FinancialEntryTypeormEntity,
  DailyFinancialConsolidationTypeormEntity
] as const;
