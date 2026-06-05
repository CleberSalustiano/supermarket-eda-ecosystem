import { bootstrapHttpApplication } from '@supermarket/shared-infra';

import { CheckoutServiceModule } from './checkout-service.module';
import { checkoutServiceEnvironment } from './infrastructure/config/checkout-service.environment';

void bootstrapHttpApplication({
  rootModule: CheckoutServiceModule,
  environment: checkoutServiceEnvironment
});
