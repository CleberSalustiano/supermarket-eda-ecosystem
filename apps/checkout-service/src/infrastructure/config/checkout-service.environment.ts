import { createServiceEnvironment } from '@supermarket/shared-infra';

export const checkoutServiceEnvironment = createServiceEnvironment({
  serviceName: 'checkout-service',
  appVersion: '0.1.0',
  servicePort: 3001,
  databaseName: 'checkout_service',
  databasePort: 5433,
  databaseUser: 'checkout_user',
  databasePassword: 'checkout_password',
  kafkaBrokers: ['localhost:19092'],
  kafkaClientId: 'checkout-service',
  kafkaConsumerGroupId: 'checkout-service'
});
