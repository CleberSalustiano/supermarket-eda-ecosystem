import { OutboxEventTypeormEntity } from './outbox-event.typeorm-entity';
import { ProductCatalogItemTypeormEntity } from './product-catalog-item.typeorm-entity';
import { PosSessionTypeormEntity } from './pos-session.typeorm-entity';
import { SaleItemTypeormEntity } from './sale-item.typeorm-entity';
import { SaleTypeormEntity } from './sale.typeorm-entity';

export const checkoutTypeormEntities = [
  OutboxEventTypeormEntity,
  ProductCatalogItemTypeormEntity,
  PosSessionTypeormEntity,
  SaleTypeormEntity,
  SaleItemTypeormEntity
];
