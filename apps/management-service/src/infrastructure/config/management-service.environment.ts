import { createServiceEnvironment } from '@supermarket/shared-infra';

export const managementServiceEnvironment = createServiceEnvironment({
  serviceName: 'management-service',
  appVersion: '0.1.0',
  servicePort: 3003,
  databaseName: 'management_service',
  databasePort: 5435,
  databaseUser: 'management_user',
  databasePassword: 'management_password',
  kafkaBrokers: ['localhost:19092'],
  kafkaClientId: 'management-service',
  kafkaConsumerGroupId: 'management-service'
});
