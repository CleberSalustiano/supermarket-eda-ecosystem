import { AppLoggerService } from '#/logging/app-logger.service';
import { bootstrapHttpApplication } from '#/bootstrap/http-application.bootstrap';
import type { ServiceEnvironment } from '#/config/service-environment';
import type { INestApplication } from '@nestjs/common';
import type {
  CorsOptions,
  CorsOptionsDelegate
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestFactory } from '@nestjs/core';
import type { Request } from 'express';

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

    const [corsOptionsDelegate] = enableCors.mock.calls[0] ?? [];

    expect(typeof corsOptionsDelegate).toBe('function');

    const corsOptions = await resolveCorsOptions(corsOptionsDelegate, '/sales');

    expect(corsOptions).toMatchObject({
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS']
    });
    expect(typeof corsOptions.origin).toBe('function');

    const originResolver = corsOptions.origin as OriginResolver;
    const allowedOriginResult = await resolveCorsDecision(originResolver, 'http://127.0.0.1:4201');
    const blockedOriginResult = await resolveCorsDecision(originResolver, 'https://unknown.example.com');
    const noOriginResult = await resolveCorsDecision(originResolver, undefined);

    expect(allowedOriginResult).toBe(true);
    expect(blockedOriginResult).toBe(false);
    expect(noOriginResult).toBe(true);
    expect(listen).toHaveBeenCalledWith(3001);
    expect(logger.setServiceContext).toHaveBeenCalledWith('checkout-service');
  });

  it('sends no cors headers for internal paths by default', async () => {
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
      environment: createEnvironment()
    });

    const [corsOptionsDelegate] = enableCors.mock.calls[0] ?? [];

    for (const path of [
      '/internal/manager-approvals/verifications',
      '/internal/manager-approvals/verifications?tenantId=1',
      '/INTERNAL/manager-approvals/verifications',
      '//internal/manager-approvals/verifications',
      '/%69nternal/manager-approvals/verifications'
    ]) {
      await expect(resolveCorsOptions(corsOptionsDelegate, path)).resolves.toEqual({
        origin: false
      });
    }

    const publicOptions = await resolveCorsOptions(corsOptionsDelegate, '/internals-report');

    await expect(
      resolveCorsDecision(publicOptions.origin as OriginResolver, 'http://127.0.0.1:4201')
    ).resolves.toBe(true);
  });

  it('uses the configured excluded path prefixes', async () => {
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
      environment: createEnvironment(),
      corsExcludedPathPrefixes: ['/private/']
    });

    const [corsOptionsDelegate] = enableCors.mock.calls[0] ?? [];

    await expect(resolveCorsOptions(corsOptionsDelegate, '/private/report')).resolves.toEqual({
      origin: false
    });
    await expect(
      resolveCorsOptions(corsOptionsDelegate, '/internal/manager-approvals/verifications')
    ).resolves.toMatchObject({ origin: expect.any(Function) });
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
}): INestApplication {
  const application = {
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

  return application as unknown as INestApplication;
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
      ssl: false,
      migrationsRun: false
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

type OriginResolver = (
  requestOrigin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void
) => void;

async function resolveCorsOptions(
  corsOptionsDelegate: CorsOptionsDelegate<Request>,
  url: string
): Promise<CorsOptions> {
  return new Promise((resolve, reject) => {
    corsOptionsDelegate({ url, originalUrl: url } as Request, (error, options) => {
      if (error) {
        reject(error);

        return;
      }

      resolve(options);
    });
  });
}

async function resolveCorsDecision(
  originResolver: OriginResolver,
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
