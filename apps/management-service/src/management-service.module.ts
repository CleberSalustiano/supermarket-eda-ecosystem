import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { CaptureInventoryLossUseCase } from './application/use-cases/capture-inventory-loss.use-case';
import { RegisterEmployeeUseCase } from './application/use-cases/register-employee.use-case';
import { RegisterProductUseCase } from './application/use-cases/register-product.use-case';
import { CompensateCanceledSaleUseCase } from './application/use-cases/compensate-canceled-sale.use-case';
import { ConsolidateCompletedSaleUseCase } from './application/use-cases/consolidate-completed-sale.use-case';
import { GenerateProfitAndLossReportUseCase } from './application/use-cases/generate-profit-and-loss-report.use-case';
import { ReconcileRegisterClosureUseCase } from './application/use-cases/reconcile-register-closure.use-case';
import { UpdateProductPriceUseCase } from './application/use-cases/update-product-price.use-case';
import { KafkaManagementSalesConsumerService } from './infrastructure/events/kafka-management-sales-consumer.service';
import { CREDENTIAL_HASHER } from './application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from './application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from './application/ports/management-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from './application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from './application/ports/outbox-event-repository.port';
import { OUTBOX_REPLAY_OPTIONS } from './application/ports/outbox-replay.options';
import { KafkaManagementEventPublisherService } from './infrastructure/events/kafka-management-event-publisher.service';
import { ReliableOutboxEventRelayService } from './infrastructure/events/reliable-outbox-event-relay.service';
import { HealthController } from './interfaces/http/health.controller';
import { EmployeesController } from './interfaces/http/employees.controller';
import { ProductsController } from './interfaces/http/products.controller';
import { ReportsController } from './interfaces/http/reports.controller';
import { InventoryLossRegisteredConsumer } from './interfaces/messaging/inventory-loss-registered.consumer';
import { RegisterClosedConsumer } from './interfaces/messaging/register-closed.consumer';
import { SaleCanceledConsumer } from './interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from './interfaces/messaging/sale-completed.consumer';
import { managementServiceEnvironment } from './infrastructure/config/management-service.environment';
import { createOutboxReplayOptions } from './infrastructure/config/outbox-replay.options';
import { managementServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { ReplayPendingOutboxEventsUseCase } from './application/use-cases/replay-pending-outbox-events.use-case';
import { TypeormOutboxEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from './infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from './infrastructure/security/scrypt-credential-hasher.service';
import { OutboxReplayWorkerService } from './infrastructure/workers/outbox-replay-worker.service';

@Module({
  imports: [TypeOrmModule.forRoot(managementServiceDataSourceOptions)],
  controllers: [HealthController, ProductsController, EmployeesController, ReportsController],
  providers: [
    AppLoggerService,
    CaptureInventoryLossUseCase,
    CompensateCanceledSaleUseCase,
    ConsolidateCompletedSaleUseCase,
    GenerateProfitAndLossReportUseCase,
    ReplayPendingOutboxEventsUseCase,
    ReconcileRegisterClosureUseCase,
    RegisterEmployeeUseCase,
    RegisterProductUseCase,
    UpdateProductPriceUseCase,
    InventoryLossRegisteredConsumer,
    KafkaManagementEventPublisherService,
    KafkaManagementSalesConsumerService,
    OutboxReplayWorkerService,
    RegisterClosedConsumer,
    ReliableOutboxEventRelayService,
    SaleCanceledConsumer,
    SaleCompletedConsumer,
    ScryptCredentialHasherService,
    TypeormManagementTransactionRunner,
    TypeormOutboxEventRepository,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: managementServiceEnvironment
    },
    {
      provide: CREDENTIAL_HASHER,
      useExisting: ScryptCredentialHasherService
    },
    {
      provide: MANAGEMENT_EVENT_PUBLISHER,
      useExisting: KafkaManagementEventPublisherService
    },
    {
      provide: OUTBOX_REPLAY_OPTIONS,
      useValue: createOutboxReplayOptions()
    },
    {
      provide: MANAGEMENT_TRANSACTION_RUNNER,
      useExisting: TypeormManagementTransactionRunner
    },
    {
      provide: OUTBOX_EVENT_RELAY,
      useExisting: ReliableOutboxEventRelayService
    },
    {
      provide: OUTBOX_EVENT_REPOSITORY,
      useExisting: TypeormOutboxEventRepository
    }
  ]
})
export class ManagementServiceModule {}
