import type { NodeEnvironment } from '@supermarket/shared-infra';
import { parseInternalApiToken } from '@supermarket/shared-infra';

export interface ManagementApprovalClientOptions {
  /** http(s) URL of management-service, without a trailing slash. */
  baseUrl: string;
  /** Bearer token sent to management's internal routes. Never logged. */
  internalApiToken: string;
  timeoutMs: number;
}

export const MANAGEMENT_APPROVAL_CLIENT_OPTIONS = Symbol('MANAGEMENT_APPROVAL_CLIENT_OPTIONS');

const LOCAL_MANAGEMENT_SERVICE_BASE_URL = 'http://localhost:3003';
const DEFAULT_TIMEOUT_MS = 2000;
const MIN_TIMEOUT_MS = 100;
const MAX_TIMEOUT_MS = 10000;

/**
 * Reads the management approval client settings at boot. Fails fast on invalid
 * values and, outside `NODE_ENV=test`, when the internal API token is missing.
 */
export function createManagementApprovalClientOptions(
  nodeEnvironment: NodeEnvironment,
  source: NodeJS.ProcessEnv = process.env
): ManagementApprovalClientOptions {
  return {
    baseUrl: parseBaseUrl(source['MANAGEMENT_SERVICE_BASE_URL'], nodeEnvironment),
    internalApiToken: parseInternalApiToken(source['MANAGEMENT_INTERNAL_API_TOKEN'], {
      variableName: 'MANAGEMENT_INTERNAL_API_TOKEN',
      nodeEnvironment
    }),
    timeoutMs: parseTimeoutMs(source['MANAGEMENT_APPROVAL_TIMEOUT_MS'])
  };
}

function parseBaseUrl(rawValue: string | undefined, nodeEnvironment: NodeEnvironment): string {
  const value = rawValue?.trim() ?? '';

  if (value.length === 0) {
    if (nodeEnvironment === 'production') {
      throw new Error('MANAGEMENT_SERVICE_BASE_URL is required');
    }

    return LOCAL_MANAGEMENT_SERVICE_BASE_URL;
  }

  if (!isValidBaseUrl(value)) {
    throw new Error(
      'MANAGEMENT_SERVICE_BASE_URL must be an http(s) URL without credentials, query, fragment or trailing slash'
    );
  }

  return value;
}

function isValidBaseUrl(value: string): boolean {
  if (value.endsWith('/')) {
    return false;
  }

  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return false;
  }

  return (
    (url.protocol === 'http:' || url.protocol === 'https:') &&
    url.username === '' &&
    url.password === '' &&
    url.search === '' &&
    url.hash === '' &&
    !value.includes('?') &&
    !value.includes('#')
  );
}

function parseTimeoutMs(rawValue: string | undefined): number {
  if (rawValue === undefined || rawValue.trim() === '') {
    return DEFAULT_TIMEOUT_MS;
  }

  const value = rawValue.trim();
  const parsedValue = /^\d+$/.test(value) ? Number.parseInt(value, 10) : Number.NaN;

  if (!Number.isInteger(parsedValue) || parsedValue < MIN_TIMEOUT_MS || parsedValue > MAX_TIMEOUT_MS) {
    throw new Error(
      `MANAGEMENT_APPROVAL_TIMEOUT_MS must be an integer from ${MIN_TIMEOUT_MS} to ${MAX_TIMEOUT_MS}`
    );
  }

  return parsedValue;
}
