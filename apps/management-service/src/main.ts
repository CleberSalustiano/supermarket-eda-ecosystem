import { bootstrapHttpApplication } from '@supermarket/shared-infra';

import { managementServiceEnvironment } from './infrastructure/config/management-service.environment';
import { ManagementServiceModule } from './management-service.module';

void bootstrapHttpApplication({
  rootModule: ManagementServiceModule,
  environment: managementServiceEnvironment
});
