import { createServiceEnvironment } from '@supermarket/shared-infra';

export const inventoryServiceEnvironment = createServiceEnvironment({
  serviceName: 'inventory-service',
  appVersion: '0.1.0',
  servicePort: 3002,
  databaseName: 'inventory_service',
  databasePort: 5434,
  databaseUser: 'inventory_user',
  databasePassword: 'inventory_password',
  kafkaBrokers: ['localhost:19092'],
  kafkaClientId: 'inventory-service',
  kafkaConsumerGroupId: 'inventory-service'
});
