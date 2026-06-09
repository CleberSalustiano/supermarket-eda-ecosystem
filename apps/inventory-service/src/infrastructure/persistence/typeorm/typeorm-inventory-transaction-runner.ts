import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type {
  InventoryTransactionContext,
  InventoryTransactionRunnerPort
} from '#/application/ports/inventory-transaction-runner.port';
import { TypeormInventoryItemRepository } from './repositories/typeorm-inventory-item.repository';
import { TypeormProcessedEventRepository } from './repositories/typeorm-processed-event.repository';
import { TypeormStockMovementRepository } from './repositories/typeorm-stock-movement.repository';

@Injectable()
export class TypeormInventoryTransactionRunner implements InventoryTransactionRunnerPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: InventoryTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        inventoryItemRepository: new TypeormInventoryItemRepository(manager),
        processedEventRepository: new TypeormProcessedEventRepository(manager),
        stockMovementRepository: new TypeormStockMovementRepository(manager)
      })
    );
  }
}
