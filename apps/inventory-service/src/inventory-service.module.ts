import { Module } from '@nestjs/common';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { HealthController } from './interfaces/http/health.controller';
import { inventoryServiceEnvironment } from './infrastructure/config/inventory-service.environment';

@Module({
  controllers: [HealthController],
  providers: [
    AppLoggerService,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: inventoryServiceEnvironment
    }
  ]
})
export class InventoryServiceModule {}
