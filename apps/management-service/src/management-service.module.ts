import { Module } from '@nestjs/common';

import { SERVICE_ENVIRONMENT, AppLoggerService } from '@supermarket/shared-infra';

import { HealthController } from './interfaces/http/health.controller';
import { managementServiceEnvironment } from './infrastructure/config/management-service.environment';

@Module({
  controllers: [HealthController],
  providers: [
    AppLoggerService,
    {
      provide: SERVICE_ENVIRONMENT,
      useValue: managementServiceEnvironment
    }
  ]
})
export class ManagementServiceModule {}
