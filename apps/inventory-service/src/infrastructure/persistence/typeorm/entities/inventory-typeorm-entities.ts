import { InventoryItemTypeormEntity } from './inventory-item.typeorm-entity';
import { ProcessedEventTypeormEntity } from './processed-event.typeorm-entity';
import { StockMovementTypeormEntity } from './stock-movement.typeorm-entity';

export const inventoryTypeormEntities = [
  InventoryItemTypeormEntity,
  StockMovementTypeormEntity,
  ProcessedEventTypeormEntity
];
