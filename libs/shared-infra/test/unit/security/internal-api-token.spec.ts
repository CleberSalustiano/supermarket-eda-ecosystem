import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { NodeEnvironment } from '#/config/service-environment';
import type { AppLoggerService } from '#/logging/app-logger.service';
import {
  InternalApiTokenGuard,
  parseInternalApiToken,
  parseInternalApiTokens
} from '#/security/internal-api-token';

const VARIABLE_NAME = 'MANAGEMENT_INTERNAL_API_TOKENS';
const FIRST_TOKEN = 'a'.repeat(31) + 'Z';
const SECOND_TOKEN = 'b1_-'.repeat(10);

function options(nodeEnvironment: NodeEnvironment = 'production') {
  return { variableName: VARIABLE_NAME, nodeEnvironment };
}

describe('parseInternalApiTokens', () => {
  it('accepts a single valid token', () => {
    expect(parseInternalApiTokens(FIRST_TOKEN, options())).toEqual([FIRST_TOKEN]);
  });

  it('accepts several comma-separated tokens, trimming and dropping empty entries', () => {
    expect(parseInternalApiTokens(` ${FIRST_TOKEN} ,, ${SECOND_TOKEN},`, options())).toEqual([
      FIRST_TOKEN,
      SECOND_TOKEN
    ]);
  });

  it('accepts a token of 256 characters', () => {
    const longToken = 'x'.repeat(256);

    expect(parseInternalApiTokens(longToken, options())).toEqual([longToken]);
  });

  it.each([
    ['a token shorter than 32 characters', 'short-token-1234567890123456789'],
    ['a token longer than 256 characters', 'y'.repeat(257)],
    ['a token with forbidden characters', `${'c'.repeat(32)}+/=`],
    ['a token with inner whitespace', `${'d'.repeat(16)} ${'d'.repeat(16)}`],
    ['one invalid token among valid ones', `${FIRST_TOKEN},${'e'.repeat(10)}`]
  ])('rejects %s without echoing the value', (_label, rawValue) => {
    const rawTokens = rawValue.split(',');

    expect.assertions(1 + rawTokens.length);

    try {
      parseInternalApiTokens(rawValue, options());
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toBe(
        `${VARIABLE_NAME} must contain tokens of at least 32 URL-safe characters`
      );

      for (const token of rawTokens) {
        expect(message).not.toContain(token.trim());
      }
    }
  });

  it.each<NodeEnvironment>(['development', 'production'])(
    'requires a value when NODE_ENV is %s',
    (nodeEnvironment) => {
      expect(() => parseInternalApiTokens(undefined, options(nodeEnvironment))).toThrow(
        `${VARIABLE_NAME} is required`
      );
      expect(() => parseInternalApiTokens(' , ', options(nodeEnvironment))).toThrow(
        `${VARIABLE_NAME} is required`
      );
    }
  );

  it('allows an empty value when NODE_ENV is test', () => {
    expect(parseInternalApiTokens(undefined, options('test'))).toEqual([]);
    expect(parseInternalApiTokens('', options('test'))).toEqual([]);
  });

  it('still validates provided tokens when NODE_ENV is test', () => {
    expect(() => parseInternalApiTokens('too-short', options('test'))).toThrow(
      `${VARIABLE_NAME} must contain tokens of at least 32 URL-safe characters`
    );
  });
});

describe('parseInternalApiToken', () => {
  const callerOptions = (nodeEnvironment: NodeEnvironment = 'production') => ({
    variableName: 'MANAGEMENT_INTERNAL_API_TOKEN',
    nodeEnvironment
  });

  it('returns exactly one valid token', () => {
    expect(parseInternalApiToken(` ${FIRST_TOKEN} `, callerOptions())).toBe(FIRST_TOKEN);
  });

  it('rejects several tokens without echoing them', () => {
    expect.assertions(3);

    try {
      parseInternalApiToken(`${FIRST_TOKEN},${SECOND_TOKEN}`, callerOptions());
    } catch (error) {
      const message = (error as Error).message;

      expect(message).toBe('MANAGEMENT_INTERNAL_API_TOKEN must contain exactly one token');
      expect(message).not.toContain(FIRST_TOKEN);
      expect(message).not.toContain(SECOND_TOKEN);
    }
  });

  it('rejects an invalid token', () => {
    expect(() => parseInternalApiToken('invalid', callerOptions())).toThrow(
      'MANAGEMENT_INTERNAL_API_TOKEN must contain tokens of at least 32 URL-safe characters'
    );
  });

  it('requires a value outside test and returns an empty string in test', () => {
    expect(() => parseInternalApiToken(undefined, callerOptions())).toThrow(
      'MANAGEMENT_INTERNAL_API_TOKEN is required'
    );
    expect(parseInternalApiToken(undefined, callerOptions('test'))).toBe('');
  });
});

describe('InternalApiTokenGuard', () => {
  it.each([FIRST_TOKEN, SECOND_TOKEN])('accepts the allowed token %s', (token) => {
    const { guard, logger } = createGuard([FIRST_TOKEN, SECOND_TOKEN]);

    expect(guard.canActivate(createContext(`Bearer ${token}`))).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('accepts a case-insensitive bearer scheme', () => {
    const { guard } = createGuard([FIRST_TOKEN]);

    expect(guard.canActivate(createContext(`bearer ${FIRST_TOKEN}`))).toBe(true);
  });

  it.each([
    ['a missing header', undefined],
    ['an empty header', ''],
    ['the wrong scheme', `Basic ${FIRST_TOKEN}`],
    ['a bare token without scheme', FIRST_TOKEN],
    ['an empty bearer token', 'Bearer '],
    ['a wrong token', `Bearer ${'f'.repeat(40)}`],
    ['a token that differs only in its last character', `Bearer ${FIRST_TOKEN.slice(0, -1)}Y`],
    ['a prefix of the allowed token', `Bearer ${FIRST_TOKEN.slice(0, -1)}`],
    ['the allowed token with a suffix', `Bearer ${FIRST_TOKEN}x`],
    ['extra content after the token', `Bearer ${FIRST_TOKEN} extra`]
  ])('rejects %s and never logs the token', (_label, authorization) => {
    const { guard, logger } = createGuard([FIRST_TOKEN, SECOND_TOKEN]);

    expect(() => guard.canActivate(createContext(authorization))).toThrow(UnauthorizedException);
    expectRejectionLoggedWithoutSecrets(logger, authorization);
  });

  it('rejects every call when the allowed list is empty', () => {
    const { guard, logger } = createGuard([]);

    expect(() => guard.canActivate(createContext(`Bearer ${FIRST_TOKEN}`))).toThrow(
      UnauthorizedException
    );
    expectRejectionLoggedWithoutSecrets(logger, `Bearer ${FIRST_TOKEN}`);
  });

  it('throws an UnauthorizedException with the plain Unauthorized message', () => {
    const { guard } = createGuard([FIRST_TOKEN]);

    expect.assertions(3);

    try {
      guard.canActivate(createContext('Bearer wrong'));
    } catch (error) {
      expect(error).toBeInstanceOf(UnauthorizedException);
      expect((error as UnauthorizedException).message).toBe('Unauthorized');
      expect((error as UnauthorizedException).getStatus()).toBe(401);
    }
  });

  it('logs the method and the path without the query string', () => {
    const { guard, logger } = createGuard([FIRST_TOKEN]);

    expect(() =>
      guard.canActivate(
        createContext(`Bearer ${SECOND_TOKEN}`, '/internal/manager-approvals/verifications?x=1')
      )
    ).toThrow(UnauthorizedException);
    expect(logger.warn).toHaveBeenCalledWith(
      'Rejected internal API call to POST /internal/manager-approvals/verifications'
    );
  });

  it('compares against every allowed token before deciding', () => {
    const crypto = require('node:crypto') as typeof import('node:crypto');
    const timingSafeEqualSpy = jest.spyOn(crypto, 'timingSafeEqual');
    const { guard } = createGuard([FIRST_TOKEN, SECOND_TOKEN, 'g'.repeat(32)]);

    try {
      guard.canActivate(createContext(`Bearer ${FIRST_TOKEN}`));

      expect(timingSafeEqualSpy).toHaveBeenCalledTimes(3);
    } finally {
      timingSafeEqualSpy.mockRestore();
    }
  });
});

function createGuard(allowedTokens: string[]) {
  const logger = {
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn()
  };
  const guard = new InternalApiTokenGuard(allowedTokens, logger as unknown as AppLoggerService);

  return { guard, logger };
}

function createContext(
  authorization: string | undefined,
  url = '/internal/manager-approvals/verifications'
): ExecutionContext {
  const request = {
    method: 'POST',
    url,
    originalUrl: url,
    headers: authorization === undefined ? {} : { authorization }
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function expectRejectionLoggedWithoutSecrets(
  logger: ReturnType<typeof createGuard>['logger'],
  authorization: string | undefined
) {
  expect(logger.warn).toHaveBeenCalledTimes(1);
  expect(logger.warn).toHaveBeenCalledWith(
    'Rejected internal API call to POST /internal/manager-approvals/verifications'
  );

  const loggedText = JSON.stringify(
    Object.values(logger).flatMap((method) => method.mock.calls)
  );

  for (const secret of [FIRST_TOKEN, SECOND_TOKEN]) {
    expect(loggedText).not.toContain(secret);
  }

  const presentedToken = authorization?.split(' ').at(-1);

  if (presentedToken && presentedToken.length >= 8) {
    expect(loggedText).not.toContain(presentedToken);
  }
}
