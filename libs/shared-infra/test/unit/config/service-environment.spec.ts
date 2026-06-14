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
    expect(environment.http.corsEnabled).toBe(true);
    expect(environment.http.corsAllowedOrigins).toContain('http://127.0.0.1:4201');
    expect(environment.database.host).toBe('localhost');
    expect(environment.kafka.brokers).toEqual(['localhost:19092']);
  });

  it('disables cors by default in production when no origins are configured explicitly', () => {
    const environment = createServiceEnvironment(defaultEnvironment, {
      NODE_ENV: 'production'
    });

    expect(environment.http.corsEnabled).toBe(false);
    expect(environment.http.corsAllowedOrigins).toEqual([]);
  });

  it('uses explicit cors origins when provided', () => {
    const environment = createServiceEnvironment(defaultEnvironment, {
      HTTP_CORS_ENABLED: 'true',
      HTTP_CORS_ORIGINS: 'https://ops.example.com, https://erp.example.com'
    });

    expect(environment.http.corsEnabled).toBe(true);
    expect(environment.http.corsAllowedOrigins).toEqual([
      'https://ops.example.com',
      'https://erp.example.com'
    ]);
  });

  it('throws when a positive integer is invalid', () => {
    expect(() =>
      createServiceEnvironment(defaultEnvironment, {
        PORT: 'not-a-number'
      })
    ).toThrow('PORT must be a positive integer');
  });
});
