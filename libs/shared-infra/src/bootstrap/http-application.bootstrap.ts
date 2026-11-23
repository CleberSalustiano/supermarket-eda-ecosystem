import { ValidationPipe } from '@nestjs/common';
import type { Type } from '@nestjs/common';
import type {
  CorsOptions,
  CorsOptionsDelegate
} from '@nestjs/common/interfaces/external/cors-options.interface';
import { NestFactory } from '@nestjs/core';
import type { Request } from 'express';

import type { ServiceEnvironment } from '../config/service-environment';
import { GlobalHttpExceptionFilter } from '../http/filters/global-http-exception.filter';
import { CorrelationIdInterceptor } from '../http/interceptors/correlation-id.interceptor';
import { AppLoggerService } from '../logging/app-logger.service';

export interface BootstrapHttpApplicationOptions {
  rootModule: Type<unknown>;
  environment: ServiceEnvironment;
  /**
   * Path prefixes that never receive CORS headers, so browsers block
   * cross-origin calls to them. Defaults to `DEFAULT_CORS_EXCLUDED_PATH_PREFIXES`.
   */
  corsExcludedPathPrefixes?: string[];
}

export const DEFAULT_CORS_EXCLUDED_PATH_PREFIXES: readonly string[] = ['/internal/'];

const CORS_ALLOWED_METHODS = ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'];

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
    app.enableCors(
      createCorsOptionsDelegate(
        options.environment.http.corsAllowedOrigins,
        options.corsExcludedPathPrefixes ?? [...DEFAULT_CORS_EXCLUDED_PATH_PREFIXES]
      )
    );
  }

  await app.listen(options.environment.servicePort);

  logger.log(`HTTP server listening on port ${options.environment.servicePort}`);
}

/**
 * Builds the per-request CORS options: requests whose path starts with an
 * excluded prefix get `{ origin: false }` (no CORS headers at all); every other
 * request uses the origin allowlist. Matching is case-insensitive, decodes
 * percent-encoding and collapses repeated slashes, because the HTTP router
 * matches routes case-insensitively.
 */
export function createCorsOptionsDelegate(
  allowedOrigins: string[],
  excludedPathPrefixes: readonly string[]
): CorsOptionsDelegate<Request> {
  const allowedCorsOptions: CorsOptions = {
    methods: CORS_ALLOWED_METHODS,
    origin: createCorsOriginResolver(allowedOrigins)
  };
  const normalizedExcludedPrefixes = excludedPathPrefixes.map((prefix) =>
    normalizeRequestPath(prefix)
  );

  return (request, callback) => {
    const requestPath = normalizeRequestPath(request.originalUrl ?? request.url ?? '');

    if (normalizedExcludedPrefixes.some((prefix) => requestPath.startsWith(prefix))) {
      callback(null, { origin: false });

      return;
    }

    callback(null, allowedCorsOptions);
  };
}

function normalizeRequestPath(url: string): string {
  const queryStart = url.search(/[?#]/);
  const path = queryStart === -1 ? url : url.slice(0, queryStart);

  return safeDecodeUriComponent(path).replace(/\/{2,}/g, '/').toLowerCase();
}

function safeDecodeUriComponent(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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
