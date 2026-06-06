import { EmployeeTypeormEntity } from './employee.typeorm-entity';
import { OutboxEventTypeormEntity } from './outbox-event.typeorm-entity';
import { ProductTypeormEntity } from './product.typeorm-entity';

export const managementTypeormEntities = [
  ProductTypeormEntity,
  EmployeeTypeormEntity,
  OutboxEventTypeormEntity
] as const;
