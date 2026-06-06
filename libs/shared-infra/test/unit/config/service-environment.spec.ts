import { createServiceEnvironment } from '#/config/service-environment';

const defaultEnvironment = {
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
};

describe('createServiceEnvironment', () => {
  it('uses safe defaults when environment variables are absent', () => {
    const environment = createServiceEnvironment(defaultEnvironment, {});

    expect(environment.serviceName).toBe('checkout-service');
    expect(environment.servicePort).toBe(3001);
    expect(environment.database.host).toBe('localhost');
    expect(environment.kafka.brokers).toEqual(['localhost:19092']);
  });

  it('throws when a positive integer is invalid', () => {
    expect(() =>
      createServiceEnvironment(defaultEnvironment, {
        PORT: 'not-a-number'
      })
    ).toThrow('PORT must be a positive integer');
  });
});
