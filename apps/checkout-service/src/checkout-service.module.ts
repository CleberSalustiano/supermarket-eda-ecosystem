import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { ScanProductByBarcodeUseCase } from './application/use-cases/scan-product-by-barcode.use-case';
import { SynchronizeProductCatalogItemUseCase } from './application/use-cases/synchronize-product-catalog-item.use-case';
import { PRODUCT_CATALOG_ITEM_REPOSITORY } from './domain/repositories/product-catalog-item.repository';
import { HealthController } from './interfaces/http/health.controller';
import { ProductCatalogController } from './interfaces/http/product-catalog.controller';
import { checkoutServiceEnvironment } from './infrastructure/config/checkout-service.environment';
import { checkoutServiceDataSourceOptions } from './infrastructure/config/typeorm.config';
import { KafkaCheckoutCatalogConsumerService } from './infrastructure/events/kafka-checkout-catalog-consumer.service';
import { TypeormProductCatalogItemRepository } from './infrastructure/persistence/typeorm/repositories/typeorm-product-catalog-item.repository';
import { ProductPriceUpdatedConsumer } from './interfaces/messaging/product-price-updated.consumer';

@Module({
  imports: [TypeOrmModule.forRoot(checkoutServiceDataSourceOptions)],
  controllers: [HealthController, ProductCatalogController],
  providers: [
    AppLoggerService,
    ScanProductByBarcodeUseCase,
    SynchronizeProductCatalogItemUseCase,
    ProductPriceUpdatedConsumer,
    KafkaCheckoutCatalogConsumerService,
    TypeormProductCatalogItemRepository,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: checkoutServiceEnvironment
    },
    {
      provide: PRODUCT_CATALOG_ITEM_REPOSITORY,
      useExisting: TypeormProductCatalogItemRepository
    }
  ]
})
export class CheckoutServiceModule {}
