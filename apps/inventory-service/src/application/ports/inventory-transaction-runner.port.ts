import type { InventoryLossRepositoryPort } from '#/domain/repositories/inventory-loss.repository';
import type { InventoryItemRepositoryPort } from '#/domain/repositories/inventory-item.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { StockMovementRepositoryPort } from '#/domain/repositories/stock-movement.repository';
import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';

export interface InventoryTransactionContext {
  inventoryLossRepository: InventoryLossRepositoryPort;
  inventoryItemRepository: InventoryItemRepositoryPort;
  outboxEventRepository: OutboxEventRepositoryPort;
  processedEventRepository: ProcessedEventRepositoryPort;
  stockMovementRepository: StockMovementRepositoryPort;
}

export interface InventoryTransactionRunnerPort {
  execute<T>(work: (context: InventoryTransactionContext) => Promise<T>): Promise<T>;
}

export const INVENTORY_TRANSACTION_RUNNER = Symbol('INVENTORY_TRANSACTION_RUNNER');
