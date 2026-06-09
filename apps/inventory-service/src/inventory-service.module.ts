import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { INVENTORY_TRANSACTION_RUNNER } from './application/ports/inventory-transaction-runner.port';
import { ProcessSaleIssueUseCase } from './application/use-cases/process-sale-issue.use-case';
import { INVENTORY_ITEM_REPOSITORY } from './domain/repositories/inventory-item.repository';
import { PROCESSED_EVENT_REPOSITORY } from './domain/repositories/processed-event.repository';
import { STOCK_MOVEMENT_REPOSITORY } from './domain/repositories/stock-movement.repository';
import { HealthController } from './interfaces/http/health.controller';
import { SaleCompletedConsumer } from './interfaces/messaging/sale-completed.consumer';
import { inventoryServiceEnvironment } from './infrastructure/config/inventory-service.environment';
import { inventoryServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { KafkaInventorySaleConsumerService } from './infrastructure/events/kafka-inventory-sale-consumer.service';
import { TypeormInventoryTransactionRunner } from './infrastructure/persistence/typeorm/typeorm-inventory-transaction-runner';
import { TypeormInventoryItemRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-inventory-item.repository';
import { TypeormProcessedEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-processed-event.repository';
import { TypeormStockMovementRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-stock-movement.repository';

@Module({
  imports: [TypeOrmModule.forRoot(inventoryServiceDataSourceOptions)],
  controllers: [HealthController],
  providers: [
    AppLoggerService,
    ProcessSaleIssueUseCase,
    SaleCompletedConsumer,
    KafkaInventorySaleConsumerService,
    TypeormInventoryTransactionRunner,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: inventoryServiceEnvironment
    },
    {
      provide: INVENTORY_ITEM_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormInventoryItemRepository(dataSource),
      inject: [DataSource]
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
