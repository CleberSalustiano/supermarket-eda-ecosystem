import { InventoryLossTypeormEntity } from './inventory-loss.typeorm-entity';
import { InventoryItemTypeormEntity } from './inventory-item.typeorm-entity';
import { OutboxEventTypeormEntity } from './outbox-event.typeorm-entity';
import { ProcessedEventTypeormEntity } from './processed-event.typeorm-entity';
import { StockMovementTypeormEntity } from './stock-movement.typeorm-entity';
import { SupplierInvoiceLineTypeormEntity } from './supplier-invoice-line.typeorm-entity';
import { SupplierInvoiceTypeormEntity } from './supplier-invoice.typeorm-entity';

export const inventoryTypeormEntities = [
  InventoryLossTypeormEntity,
  InventoryItemTypeormEntity,
  OutboxEventTypeormEntity,
  StockMovementTypeormEntity,
  ProcessedEventTypeormEntity,
  SupplierInvoiceTypeormEntity,
  SupplierInvoiceLineTypeormEntity
];
