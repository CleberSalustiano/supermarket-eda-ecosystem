import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type {
  InventoryTransactionContext,
  InventoryTransactionRunnerPort
} from '#/application/ports/inventory-transaction-runner.port';
import { TypeormInventoryLossRepository } from './repositories/typeorm-inventory-loss.repository';
import { TypeormInventoryItemRepository } from './repositories/typeorm-inventory-item.repository';
import { TypeormOutboxEventRepository } from './repositories/typeorm-outbox-event.repository';
import { TypeormPhysicalInventoryAdjustmentRepository } from './repositories/typeorm-physical-inventory-adjustment.repository';
import { TypeormProcessedEventRepository } from './repositories/typeorm-processed-event.repository';
import { TypeormStockMovementRepository } from './repositories/typeorm-stock-movement.repository';
import { TypeormSupplierInvoiceRepository } from './repositories/typeorm-supplier-invoice.repository';

@Injectable()
export class TypeormInventoryTransactionRunner implements InventoryTransactionRunnerPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: InventoryTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        inventoryLossRepository: new TypeormInventoryLossRepository(manager),
        inventoryItemRepository: new TypeormInventoryItemRepository(manager),
        outboxEventRepository: new TypeormOutboxEventRepository(manager),
        physicalInventoryAdjustmentRepository: new TypeormPhysicalInventoryAdjustmentRepository(
          manager
        ),
        processedEventRepository: new TypeormProcessedEventRepository(manager),
        stockMovementRepository: new TypeormStockMovementRepository(manager),
        supplierInvoiceRepository: new TypeormSupplierInvoiceRepository(manager)
      })
    );
  }
}
