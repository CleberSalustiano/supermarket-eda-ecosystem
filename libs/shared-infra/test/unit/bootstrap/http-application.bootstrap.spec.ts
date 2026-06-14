import { AppLoggerService } from '#/logging/app-logger.service';
import { bootstrapHttpApplication } from '#/bootstrap/http-application.bootstrap';
import type { ServiceEnvironment } from '#/config/service-environment';
import { NestFactory } from '@nestjs/core';

jest.mock('@nestjs/core', () => ({
  NestFactory: {
    create: jest.fn()
  }
}));

class TestRootModule {}

describe('bootstrapHttpApplication', () => {
  const createMock = jest.mocked(NestFactory.create);

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('enables cors with the configured origins', async () => {
    const enableCors = jest.fn();
    const listen = jest.fn().mockResolvedValue(undefined);
    const logger = createLoggerMock();

    createMock.mockResolvedValue(
      createApplicationMock({
        enableCors,
        listen,
        logger
      })
    );

    await bootstrapHttpApplication({
      rootModule: TestRootModule,
      environment: createEnvironment({
        http: {
          corsEnabled: true,
          corsAllowedOrigins: ['http://127.0.0.1:4201']
        }
      })
    });

    expect(enableCors).toHaveBeenCalledTimes(1);

    const [corsOptions] = enableCors.mock.calls[0] ?? [];

    expect(corsOptions).toMatchObject({
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
    });
    expect(typeof corsOptions.origin).toBe('function');

    const allowedOriginResult = await resolveCorsDecision(corsOptions.origin, 'http://127.0.0.1:4201');
    const blockedOriginResult = await resolveCorsDecision(corsOptions.origin, 'https://unknown.example.com');
    const noOriginResult = await resolveCorsDecision(corsOptions.origin, undefined);

    expect(allowedOriginResult).toBe(true);
    expect(blockedOriginResult).toBe(false);
    expect(noOriginResult).toBe(true);
    expect(listen).toHaveBeenCalledWith(3001);
    expect(logger.setServiceContext).toHaveBeenCalledWith('checkout-service');
  });

  it('skips cors when disabled explicitly', async () => {
    const enableCors = jest.fn();

    createMock.mockResolvedValue(
      createApplicationMock({
        enableCors,
        listen: jest.fn().mockResolvedValue(undefined),
        logger: createLoggerMock()
      })
    );

    await bootstrapHttpApplication({
      rootModule: TestRootModule,
      environment: createEnvironment({
        http: {
          corsEnabled: false,
          corsAllowedOrigins: []
        }
      })
    });

    expect(enableCors).not.toHaveBeenCalled();
  });
});

function createApplicationMock({
  enableCors,
  listen,
  logger
}: {
  enableCors: jest.Mock;
  listen: jest.Mock;
  logger: ReturnType<typeof createLoggerMock>;
}) {
  return {
    get: jest.fn().mockImplementation((token: unknown) => {
      if (token === AppLoggerService) {
        return logger;
      }

      throw new Error('Unexpected token');
    }),
    useLogger: jest.fn(),
    useGlobalPipes: jest.fn(),
    useGlobalInterceptors: jest.fn(),
    useGlobalFilters: jest.fn(),
    enableShutdownHooks: jest.fn(),
    enableCors,
    listen
  };
}

function createEnvironment(overrides?: Partial<ServiceEnvironment>): ServiceEnvironment {
  return {
    nodeEnvironment: 'development',
    serviceName: 'checkout-service',
    appVersion: '0.1.0',
    servicePort: 3001,
    http: {
      corsEnabled: true,
      corsAllowedOrigins: ['http://127.0.0.1:4201']
    },
    database: {
      host: 'localhost',
      port: 5433,
      name: 'checkout_service',
      user: 'checkout_user',
      password: 'checkout_password',
      ssl: false
    },
    kafka: {
      brokers: ['localhost:19092'],
      clientId: 'checkout-service',
      consumerGroupId: 'checkout-service'
    },
    ...overrides
  };
}

function createLoggerMock() {
  return {
    setServiceContext: jest.fn(),
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  };
}

async function resolveCorsDecision(
  originResolver: (requestOrigin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void,
  requestOrigin: string | undefined
): Promise<boolean | undefined> {
  return new Promise((resolve, reject) => {
    originResolver(requestOrigin, (error, allow) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(allow);
    });
  });
}
