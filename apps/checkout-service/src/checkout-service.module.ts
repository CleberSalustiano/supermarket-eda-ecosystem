import { Module } from '@nestjs/common';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { HealthController } from './interfaces/http/health.controller';
import { checkoutServiceEnvironment } from './infrastructure/config/checkout-service.environment';

@Module({
  controllers: [HealthController],
  providers: [
    AppLoggerService,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: checkoutServiceEnvironment
    }
  ]
})
export class CheckoutServiceModule {}
