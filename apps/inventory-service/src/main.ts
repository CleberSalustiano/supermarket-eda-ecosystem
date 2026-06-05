import { bootstrapHttpApplication } from '@supermarket/shared-infra';

import { inventoryServiceEnvironment } from './infrastructure/config/inventory-service.environment';
import { InventoryServiceModule } from './inventory-service.module';

void bootstrapHttpApplication({
  rootModule: InventoryServiceModule,
  environment: inventoryServiceEnvironment
});
