import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  UnauthorizedException
} from '@nestjs/common';
import type { ArgumentsHost } from '@nestjs/common';
import {
  AuthorizationDeniedError,
  ConflictError,
  DependencyUnavailableError,
  DomainValidationError,
  ResourceNotFoundError,
  TooManyAttemptsError
} from '@supermarket/shared-domain';

import { GlobalHttpExceptionFilter } from '#/http/filters/global-http-exception.filter';
import type { AppLoggerService } from '#/logging/app-logger.service';

describe('GlobalHttpExceptionFilter', () => {
  it.each([
    [new DomainValidationError('invalid'), HttpStatus.BAD_REQUEST, 'DOMAIN_VALIDATION_ERROR'],
    [new AuthorizationDeniedError('denied'), HttpStatus.FORBIDDEN, 'AUTHORIZATION_DENIED'],
    [new ResourceNotFoundError('missing'), HttpStatus.NOT_FOUND, 'RESOURCE_NOT_FOUND'],
    [new ConflictError('conflict'), HttpStatus.CONFLICT, 'CONFLICT'],
    [new TooManyAttemptsError('locked'), HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_ATTEMPTS'],
    [
      new DependencyUnavailableError('management unavailable'),
      HttpStatus.SERVICE_UNAVAILABLE,
      'DEPENDENCY_UNAVAILABLE'
    ]
  ])('maps %p to its status with a stable code', (exception, expectedStatus, expectedCode) => {
    const { filter, host, response } = createFixture();

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(expectedStatus);
    expect(response.json).toHaveBeenCalledWith({
      statusCode: expectedStatus,
      message: exception.message,
      path: '/sales/sale-1/cancellation',
      correlationId: 'correlation-1',
      timestamp: expect.any(String),
      code: expectedCode
    });
  });

  it.each([
    [new BadRequestException('bad request'), HttpStatus.BAD_REQUEST, 'bad request'],
    [new UnauthorizedException('Unauthorized'), HttpStatus.UNAUTHORIZED, 'Unauthorized'],
    [new ForbiddenException('forbidden'), HttpStatus.FORBIDDEN, 'forbidden']
  ])(
    'keeps the HttpException status of %p and sends no code',
    (exception, expectedStatus, expectedMessage) => {
      const { filter, host, response } = createFixture();

      filter.catch(exception, host);

      expect(response.status).toHaveBeenCalledWith(expectedStatus);

      const [body] = response.json.mock.calls[0] ?? [];

      expect(body).toMatchObject({ statusCode: expectedStatus, message: expectedMessage });
      expect(body).not.toHaveProperty('code');
    }
  );

  it('maps unknown errors to 500 without exposing their code or stack', () => {
    const { filter, host, response, logger } = createFixture();
    const driverError = Object.assign(new Error('duplicate key value'), { code: '23505' });

    filter.catch(driverError, host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);

    const [body] = response.json.mock.calls[0] ?? [];

    expect(body).not.toHaveProperty('code');
    expect(body).not.toHaveProperty('stack');
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('maps non-error values to 500 with a generic message', () => {
    const { filter, host, response } = createFixture();

    filter.catch('boom', host);

    expect(response.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Internal server error' })
    );
  });

  it('logs client errors as warnings and 5xx errors as errors', () => {
    const tooManyAttempts = createFixture();

    tooManyAttempts.filter.catch(new TooManyAttemptsError('locked'), tooManyAttempts.host);

    expect(tooManyAttempts.logger.warn).toHaveBeenCalledTimes(1);
    expect(tooManyAttempts.logger.error).not.toHaveBeenCalled();

    const dependencyUnavailable = createFixture();

    dependencyUnavailable.filter.catch(
      new DependencyUnavailableError('management unavailable'),
      dependencyUnavailable.host
    );

    expect(dependencyUnavailable.logger.error).toHaveBeenCalledTimes(1);
    expect(dependencyUnavailable.logger.warn).not.toHaveBeenCalled();
  });
});

function createFixture() {
  const logger = {
    warn: jest.fn(),
    error: jest.fn()
  };
  const response = {
    status: jest.fn(),
    json: jest.fn()
  };

  response.status.mockReturnValue(response);

  const request = {
    method: 'POST',
    url: '/sales/sale-1/cancellation',
    originalUrl: '/sales/sale-1/cancellation',
    headers: { 'x-correlation-id': 'correlation-1' }
  };
  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response
    })
  } as unknown as ArgumentsHost;
  const filter = new GlobalHttpExceptionFilter(logger as unknown as AppLoggerService);

  return { filter, host, response, logger };
}
