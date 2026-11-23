import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import {
  AuthorizationDeniedError,
  ConflictError,
  DependencyUnavailableError,
  DomainValidationError,
  ResourceNotFoundError,
  TooManyAttemptsError
} from '@supermarket/shared-domain';

import { AppLoggerService } from '../../logging/app-logger.service';
import {
  CORRELATION_ID_CONTEXT_KEY,
  type RequestWithCorrelationId,
  resolveCorrelationId
} from '../interceptors/correlation-id.interceptor';

interface HttpErrorResponseBody {
  statusCode: number;
  message: string;
  path: string;
  correlationId: string;
  timestamp: string;
  code?: string;
}

type DomainErrorClass = abstract new (...args: never[]) => Error;

/**
 * Shared-domain errors and their HTTP status. Only these errors expose their
 * `code` in the response body, so unmapped errors (driver or system errors
 * that also carry a `code`) never leak internals in a 500 response.
 */
const DOMAIN_ERROR_HTTP_STATUSES: ReadonlyArray<readonly [DomainErrorClass, HttpStatus]> = [
  [DomainValidationError, HttpStatus.BAD_REQUEST],
  [AuthorizationDeniedError, HttpStatus.FORBIDDEN],
  [ResourceNotFoundError, HttpStatus.NOT_FOUND],
  [ConflictError, HttpStatus.CONFLICT],
  [TooManyAttemptsError, HttpStatus.TOO_MANY_REQUESTS],
  [DependencyUnavailableError, HttpStatus.SERVICE_UNAVAILABLE]
];

@Catch()
export class GlobalHttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLoggerService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelationId>();
    const response = httpContext.getResponse<Response>();
    const statusCode = resolveHttpStatusCode(exception);
    const correlationId =
      request[CORRELATION_ID_CONTEXT_KEY] ??
      resolveCorrelationId(request.headers['x-correlation-id']);
    const message = resolveExceptionMessage(exception);
    const code = resolveExceptionCode(exception);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled exception for ${request.method} ${request.url}: ${message}`,
        exception instanceof Error ? exception.stack : undefined
      );
    } else {
      this.logger.warn(`Handled exception for ${request.method} ${request.url}: ${message}`);
    }

    const responseBody: HttpErrorResponseBody = {
      statusCode,
      message,
      path: request.originalUrl ?? request.url,
      correlationId,
      timestamp: new Date().toISOString(),
      ...(code === undefined ? {} : { code })
    };

    response.status(statusCode).json(responseBody);
  }
}

function resolveExceptionMessage(exception: unknown): string {
  if (exception instanceof HttpException) {
    const response = exception.getResponse();

    if (typeof response === 'string') {
      return response;
    }

    if (
      typeof response === 'object' &&
      response &&
      'message' in response &&
      typeof response.message === 'string'
    ) {
      return response.message;
    }
  }

  if (exception instanceof Error) {
    return exception.message;
  }

  return 'Internal server error';
}

function resolveHttpStatusCode(exception: unknown): number {
  if (exception instanceof HttpException) {
    return exception.getStatus();
  }

  return resolveDomainErrorHttpStatus(exception) ?? HttpStatus.INTERNAL_SERVER_ERROR;
}

function resolveExceptionCode(exception: unknown): string | undefined {
  if (resolveDomainErrorHttpStatus(exception) === undefined) {
    return undefined;
  }

  const { code } = exception as { code?: unknown };

  return typeof code === 'string' ? code : undefined;
}

function resolveDomainErrorHttpStatus(exception: unknown): HttpStatus | undefined {
  const mapping = DOMAIN_ERROR_HTTP_STATUSES.find(
    ([errorConstructor]) => exception instanceof errorConstructor
  );

  return mapping?.[1];
}
