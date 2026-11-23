import { parseInternalApiTokens } from '@supermarket/shared-infra';
import type { NodeEnvironment } from '@supermarket/shared-infra';

import { managementServiceEnvironment } from './management-service.environment';

export const MANAGEMENT_INTERNAL_API_TOKENS_VARIABLE = 'MANAGEMENT_INTERNAL_API_TOKENS';

/**
 * Tokens accepted on management's `/internal/...` routes. Throws at boot when
 * the variable is missing or invalid outside `NODE_ENV=test`.
 */
export function createManagementInternalApiTokens(
  source: NodeJS.ProcessEnv = process.env,
  nodeEnvironment: NodeEnvironment = managementServiceEnvironment.nodeEnvironment
): string[] {
  return parseInternalApiTokens(source[MANAGEMENT_INTERNAL_API_TOKENS_VARIABLE], {
    variableName: MANAGEMENT_INTERNAL_API_TOKENS_VARIABLE,
    nodeEnvironment
  });
}
