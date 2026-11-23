import { createHash, timingSafeEqual } from 'node:crypto';

import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

import type { NodeEnvironment } from '../config/service-environment';
import { AppLoggerService } from '../logging/app-logger.service';

export const INTERNAL_API_TOKENS = Symbol('INTERNAL_API_TOKENS');

export interface InternalApiTokenParseOptions {
  variableName: string;
  nodeEnvironment: NodeEnvironment;
}

const INTERNAL_API_TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,256}$/;
const BEARER_AUTHORIZATION_PATTERN = /^Bearer ([^\s]+)$/i;

/**
 * Parses a comma-separated list of internal API tokens (several values allow
 * rotation without downtime). Fails fast when the list is empty outside
 * `NODE_ENV=test`. Error messages never include a token value.
 */
export function parseInternalApiTokens(
  raw: string | undefined,
  options: InternalApiTokenParseOptions
): string[] {
  const tokens = (raw ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (tokens.some((token) => !INTERNAL_API_TOKEN_PATTERN.test(token))) {
    throw new Error(
      `${options.variableName} must contain tokens of at least 32 URL-safe characters`
    );
  }

  if (tokens.length === 0 && options.nodeEnvironment !== 'test') {
    throw new Error(`${options.variableName} is required`);
  }

  return tokens;
}

/**
 * Parses exactly one internal API token (the caller side). Follows the same
 * rules as `parseInternalApiTokens`; returns an empty string only when the
 * value is absent under `NODE_ENV=test`.
 */
export function parseInternalApiToken(
  raw: string | undefined,
  options: InternalApiTokenParseOptions
): string {
  const tokens = parseInternalApiTokens(raw, options);

  if (tokens.length > 1) {
    throw new Error(`${options.variableName} must contain exactly one token`);
  }

  return tokens[0] ?? '';
}

/**
 * Protects `/internal/...` routes. Compares SHA-256 digests of the presented
 * bearer token against every allowed token with `timingSafeEqual`, without an
 * early exit, and never logs the token.
 */
@Injectable()
export class InternalApiTokenGuard implements CanActivate {
  private readonly allowedTokenDigests: Buffer[];

  constructor(
    @Inject(INTERNAL_API_TOKENS) allowedTokens: string[],
    private readonly logger: AppLoggerService
  ) {
    this.allowedTokenDigests = allowedTokens.map((token) => digestToken(token));
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const presentedToken = extractBearerToken(request.headers.authorization);

    if (presentedToken !== undefined && this.isAllowedToken(presentedToken)) {
      return true;
    }

    this.logger.warn(
      `Rejected internal API call to ${request.method} ${resolveRequestPath(request)}`
    );

    throw new UnauthorizedException('Unauthorized');
  }

  private isAllowedToken(presentedToken: string): boolean {
    const presentedDigest = digestToken(presentedToken);
    let matched = false;

    for (const allowedDigest of this.allowedTokenDigests) {
      const isMatch = timingSafeEqual(presentedDigest, allowedDigest);

      matched = matched || isMatch;
    }

    return matched;
  }
}

function extractBearerToken(authorization: unknown): string | undefined {
  if (typeof authorization !== 'string') {
    return undefined;
  }

  return BEARER_AUTHORIZATION_PATTERN.exec(authorization)?.[1];
}

function digestToken(token: string): Buffer {
  return createHash('sha256').update(token, 'utf8').digest();
}

function resolveRequestPath(request: Request): string {
  const url = request.originalUrl ?? request.url;
  const queryStart = url.indexOf('?');

  return queryStart === -1 ? url : url.slice(0, queryStart);
}
