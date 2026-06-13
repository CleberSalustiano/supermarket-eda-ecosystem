import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { INVENTORY_EVENT_PUBLISHER } from './application/ports/inventory-event-publisher.port';
import { INVENTORY_TRANSACTION_RUNNER } from './application/ports/inventory-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from './application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from './application/ports/outbox-event-repository.port';
import { ProcessSaleIssueUseCase } from './application/use-cases/process-sale-issue.use-case';
import { RegisterInventoryLossUseCase } from './application/use-cases/register-inventory-loss.use-case';
import { RegisterSupplierInvoiceUseCase } from './application/use-cases/register-supplier-invoice.use-case';
import { RevertSaleIssueUseCase } from './application/use-cases/revert-sale-issue.use-case';
import { INVENTORY_LOSS_REPOSITORY } from './domain/repositories/inventory-loss.repository';
import { INVENTORY_ITEM_REPOSITORY } from './domain/repositories/inventory-item.repository';
import { PROCESSED_EVENT_REPOSITORY } from './domain/repositories/processed-event.repository';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/repositories/stock-movement.repository';
import { HealthController } from './interfaces/http/health.controller';
import { InventoryLossesController } from './interfaces/http/inventory-losses.controller';
import { SupplierInvoicesController } from './interfaces/http/supplier-invoices.controller';
import { SaleCanceledConsumer } from './interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from './interfaces/messaging/sale-completed.consumer';
import { inventoryServiceEnvironment } from './infrastructure/config/inventory-service.environment';
import { inventoryServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { KafkaInventoryEventPublisherService } from './infrastructure/events/kafka-inventory-event-publisher.service';
import { KafkaInventorySaleConsumerService } from './infrastructure/events/kafka-inventory-sale-consumer.service';
import { ReliableOutboxEventRelayService } from './infrastructure/events/reliable-outbox-event-relay.service';
import { TypeormInventoryTransactionRunner } from './infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormInventoryLossRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-inventory-loss.repository';
import { TypeormInventoryItemRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-inventory-item.repository';
import { TypeormOutboxEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormProcessedEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-processed-event.repository';
import { TypeormStockMovementRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-stock-movement.repository';

@Module({
  imports: [TypeOrmModule.forRoot(inventoryServiceDataSourceOptions)],
  controllers: [HealthController, InventoryLossesController, SupplierInvoicesController],
  providers: [
    AppLoggerService,
    ProcessSaleIssueUseCase,
    RegisterInventoryLossUseCase,
    RegisterSupplierInvoiceUseCase,
    RevertSaleIssueUseCase,
    KafkaInventoryEventPublisherService,
    SaleCanceledConsumer,
    SaleCompletedConsumer,
    KafkaInventorySaleConsumerService,
    ReliableOutboxEventRelayService,
    TypeormInventoryTransactionRunner,
    TypeormOutboxEventRepository,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: inventoryServiceEnvironment
    },
    {
      provide: INVENTORY_EVENT_PUBLISHER,
      useExisting: KafkaInventoryEventPublisherService
    },
    {
      provide: INVENTORY_LOSS_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormInventoryLossRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: INVENTORY_ITEM_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormInventoryItemRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: OUTBOX_EVENT_RELAY,
      useExisting: ReliableOutboxEventRelayService
    },
    {
      provide: OUTBOX_EVENT_REPOSITORY,
      useExisting: TypeormOutboxEventRepository
    },
    {
      provide: STOCK_MOVEMENT_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormStockMovementRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: PROCESSED_EVENT_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormProcessedEventRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: INVENTORY_TRANSACTION_RUNNER,
      useExisting: TypeormInventoryTransactionRunner
    }
  ]
})
export class InventoryServiceModule {}
