import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { RegisterEmployeeUseCase } from './application/use-cases/register-employee.use-case';
import { RegisterProductUseCase } from './application/use-cases/register-product.use-case';
import { CompensateCanceledSaleUseCase } from './application/use-cases/compensate-canceled-sale.use-case';
import { ConsolidateCompletedSaleUseCase } from './application/use-cases/consolidate-completed-sale.use-case';
import { ReconcileRegisterClosureUseCase } from './application/use-cases/reconcile-register-closure.use-case';
import { UpdateProductPriceUseCase } from './application/use-cases/update-product-price.use-case';
import { KafkaManagementSalesConsumerService } from './infrastructure/events/kafka-management-sales-consumer.service';
import { CREDENTIAL_HASHER } from './application/ports/credential-hasher.port';
import { MANAGEMENT_EVENT_PUBLISHER } from './application/ports/management-event-publisher.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from './application/ports/management-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from './application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from './application/ports/outbox-event-repository.port';
import { KafkaManagementEventPublisherService } from './infrastructure/events/kafka-management-event-publisher.service';
import { ReliableOutboxEventRelayService } from './infrastructure/events/reliable-outbox-event-relay.service';
import { HealthController } from './interfaces/http/health.controller';
import { EmployeesController } from './interfaces/http/employees.controller';
import { ProductsController } from './interfaces/http/products.controller';
import { RegisterClosedConsumer } from './interfaces/messaging/register-closed.consumer';
import { SaleCanceledConsumer } from './interfaces/messaging/sale-canceled.consumer';
import { SaleCompletedConsumer } from './interfaces/messaging/sale-completed.consumer';
import { managementServiceEnvironment } from './infrastructure/config/management-service.environment';
import { managementServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { TypeormOutboxEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormManagementTransactionRunner } from './infrastructure/persistence/typeorm/typeorm-management-transaction-runner';
import { ScryptCredentialHasherService } from './infrastructure/security/scrypt-credential-hasher.service';

@Module({
  imports: [TypeOrmModule.forRoot(managementServiceDataSourceOptions)],
  controllers: [HealthController, ProductsController, EmployeesController],
  providers: [
    AppLoggerService,
    CompensateCanceledSaleUseCase,
    ConsolidateCompletedSaleUseCase,
    ReconcileRegisterClosureUseCase,
    RegisterEmployeeUseCase,
    RegisterProductUseCase,
    UpdateProductPriceUseCase,
    KafkaManagementEventPublisherService,
    KafkaManagementSalesConsumerService,
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
