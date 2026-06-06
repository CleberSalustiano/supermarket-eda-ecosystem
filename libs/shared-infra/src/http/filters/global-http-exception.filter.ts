import { Catch, HttpException, HttpStatus } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

import {
  ConflictError,
  DomainValidationError,
  ResourceNotFoundError
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
}

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
      timestamp: new Date().toISOString()
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
      response !== null &&
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

  if (exception instanceof DomainValidationError) {
    return HttpStatus.BAD_REQUEST;
  }

  if (exception instanceof ResourceNotFoundError) {
    return HttpStatus.NOT_FOUND;
  }

  if (exception instanceof ConflictError) {
    return HttpStatus.CONFLICT;
  }

  return HttpStatus.INTERNAL_SERVER_ERROR;
}
