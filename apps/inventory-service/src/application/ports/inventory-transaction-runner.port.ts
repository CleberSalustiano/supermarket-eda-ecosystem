import type { InventoryItemRepositoryPort } from '#/domain/repositories/inventory-item.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { StockMovementRepositoryPort } from '#/domain/repositories/stock-movement.repository';

export interface InventoryTransactionContext {
  inventoryItemRepository: InventoryItemRepositoryPort;
  processedEventRepository: ProcessedEventRepositoryPort;
  stockMovementRepository: StockMovementRepositoryPort;
}

export interface InventoryTransactionRunnerPort {
  execute<T>(work: (context: InventoryTransactionContext) => Promise<T>): Promise<T>;
}

export const INVENTORY_TRANSACTION_RUNNER = Symbol('INVENTORY_TRANSACTION_RUNNER');
