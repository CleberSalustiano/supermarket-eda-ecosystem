import { Controller, Get, Inject } from '@nestjs/common';

import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

interface HealthResponse {
  status: 'ok';
  service: string;
  version: string;
  environment: string;
  timestamp: string;
}

@Controller('health')
export class HealthController {
  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment
  ) {}

  @Get()
  getHealth(): HealthResponse {
    return {
      status: 'ok',
      service: this.environment.serviceName,
      version: this.environment.appVersion,
      environment: this.environment.nodeEnvironment,
      timestamp: new Date().toISOString()
    };
  }
}
