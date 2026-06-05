import { randomUUID } from 'crypto';

import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { Observable } from 'rxjs';

export const CORRELATION_ID_HEADER = 'x-correlation-id';
export const CORRELATION_ID_CONTEXT_KEY = 'correlationId';

export type RequestWithCorrelationId = Request & {
  correlationId?: string;
};

export function resolveCorrelationId(rawHeader: string | string[] | undefined): string {
  const correlationId = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;

  if (correlationId !== undefined && correlationId.trim().length > 0) {
    return correlationId.trim();
  }

  return randomUUID();
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<RequestWithCorrelationId>();
    const response = httpContext.getResponse<Response>();
    const correlationId = resolveCorrelationId(request.headers[CORRELATION_ID_HEADER]);

    request.correlationId = correlationId;
    response.setHeader(CORRELATION_ID_HEADER, correlationId);

    return next.handle();
  }
}
