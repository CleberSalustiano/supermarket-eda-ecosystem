import { ValidationPipe } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import type { ServiceEnvironment } from '../config/service-environment';
import { GlobalHttpExceptionFilter } from '../http/filters/global-http-exception.filter';
import { CorrelationIdInterceptor } from '../http/interceptors/correlation-id.interceptor';
import { AppLoggerService } from '../logging/app-logger.service';

export interface BootstrapHttpApplicationOptions {
  rootModule: Type<unknown>;
  environment: ServiceEnvironment;
}

export async function bootstrapHttpApplication(
  options: BootstrapHttpApplicationOptions
): Promise<void> {
  const app = await NestFactory.create(options.rootModule, {
    bufferLogs: true
  });
  const logger = app.get(AppLoggerService);

  logger.setServiceContext(options.environment.serviceName);
  app.useLogger(logger);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: false
      }
    })
  );
  app.useGlobalInterceptors(new CorrelationIdInterceptor());
  app.useGlobalFilters(new GlobalHttpExceptionFilter(logger));
  app.enableShutdownHooks();

  if (options.environment.http.corsEnabled) {
    app.enableCors({
      methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
      origin: createCorsOriginResolver(options.environment.http.corsAllowedOrigins)
    });
  }

  await app.listen(options.environment.servicePort);

  logger.log(`HTTP server listening on port ${options.environment.servicePort}`);
}

function createCorsOriginResolver(
  allowedOrigins: string[]
): true | ((requestOrigin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void) {
  if (allowedOrigins.includes('*')) {
    return true;
  }

  return (requestOrigin, callback) => {
    if (requestOrigin === undefined || allowedOrigins.includes(requestOrigin)) {
      callback(null, true);

      return;
    }

    callback(null, false);
  };
}
