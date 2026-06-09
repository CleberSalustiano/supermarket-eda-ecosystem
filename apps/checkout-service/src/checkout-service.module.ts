import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { CHECKOUT_EVENT_PUBLISHER } from './application/ports/checkout-event-publisher.port';
import { CHECKOUT_TRANSACTION_RUNNER } from './application/ports/checkout-transaction-runner.port';
import { OUTBOX_EVENT_RELAY } from './application/ports/outbox-event-relay.port';
import { OUTBOX_EVENT_REPOSITORY } from './application/ports/outbox-event-repository.port';
import { AddSaleItemUseCase } from './application/use-cases/add-sale-item.use-case';
import { CompleteSaleUseCase } from './application/use-cases/complete-sale.use-case';
import { OpenPosSessionUseCase } from './application/use-cases/open-pos-session.use-case';
import { ProcessSalePaymentUseCase } from './application/use-cases/process-sale-payment.use-case';
import { RemoveSaleItemUseCase } from './application/use-cases/remove-sale-item.use-case';
import { ScanProductByBarcodeUseCase } from './application/use-cases/scan-product-by-barcode.use-case';
import { StartSaleUseCase } from './application/use-cases/start-sale.use-case';
import { SynchronizeProductCatalogItemUseCase } from './application/use-cases/synchronize-product-catalog-item.use-case';
import { POS_SESSION_REPOSITORY } from './domain/repositories/pos-session.repository';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from './domain/repositories/product-catalog-item.repository';
import { HealthController } from './interfaces/http/health.controller';
import { PosSessionsController } from './interfaces/http/pos-sessions.controller';
import { ProductCatalogController } from './interfaces/http/product-catalog.controller';
import { SalesController } from './interfaces/http/sales.controller';
import { checkoutServiceEnvironment } from './infrastructure/config/checkout-service.environment';
import { checkoutServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { KafkaCheckoutCatalogConsumerService } from './infrastructure/events/kafka-checkout-catalog-consumer.service';
import { KafkaCheckoutEventPublisherService } from './infrastructure/events/kafka-checkout-event-publisher.service';
import { ReliableOutboxEventRelayService } from './infrastructure/events/reliable-outbox-event-relay.service';
import { TypeormCheckoutTransactionRunner } from './infrastructure/persistence/typeorm/typeorm-checkout-transaction-runner';
import { TypeormOutboxEventRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-outbox-event.repository';
import { TypeormPosSessionRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-pos-session.repository';
import { TypeormProductCatalogItemRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { TypeormSaleRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-sale.repository';
import { SALE_REPOSITORY } from './domain/repositories/sale.repository';
import { ProductPriceUpdatedConsumer } from './interfaces/messaging/product-price-updated.consumer';

@Module({
  imports: [TypeOrmModule.forRoot(checkoutServiceDataSourceOptions)],
  controllers: [HealthController, ProductCatalogController, PosSessionsController, SalesController],
  providers: [
    AppLoggerService,
    OpenPosSessionUseCase,
    StartSaleUseCase,
    AddSaleItemUseCase,
    RemoveSaleItemUseCase,
    ProcessSalePaymentUseCase,
    CompleteSaleUseCase,
    ScanProductByBarcodeUseCase,
    SynchronizeProductCatalogItemUseCase,
    ProductPriceUpdatedConsumer,
    KafkaCheckoutCatalogConsumerService,
    KafkaCheckoutEventPublisherService,
    ReliableOutboxEventRelayService,
    TypeormCheckoutTransactionRunner,
    TypeormOutboxEventRepository,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: checkoutServiceEnvironment
    },
    {
      provide: PRODUCT_CATALOG_ITEM_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormProductCatalogItemRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: POS_SESSION_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormPosSessionRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: SALE_REPOSITORY,
      useFactory: (dataSource: DataSource) => new TypeormSaleRepository(dataSource),
      inject: [DataSource]
    },
    {
      provide: CHECKOUT_TRANSACTION_RUNNER,
      useExisting: TypeormCheckoutTransactionRunner
    },
    {
      provide: CHECKOUT_EVENT_PUBLISHER,
      useExisting: KafkaCheckoutEventPublisherService
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
export class CheckoutServiceModule {}
