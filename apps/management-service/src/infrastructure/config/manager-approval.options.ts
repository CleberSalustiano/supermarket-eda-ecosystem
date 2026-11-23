import type { ManagerApprovalOptions } from '#/application/ports/manager-approval.options';
import { ApprovalThrottlePolicy } from '#/domain/value-objects/approval-throttle-policy';

const MILLISECONDS_PER_MINUTE = 60_000;

export function createManagerApprovalOptions(
  source: NodeJS.ProcessEnv = process.env
): ManagerApprovalOptions {
  return {
    approverCodePolicy: ApprovalThrottlePolicy.create({
      maxFailures: parsePositiveInteger(source, 'MANAGER_APPROVAL_CODE_MAX_FAILURES', 5),
      windowMs:
        parsePositiveInteger(source, 'MANAGER_APPROVAL_CODE_WINDOW_MINUTES', 15) *
        MILLISECONDS_PER_MINUTE,
      lockoutMs:
        parsePositiveInteger(source, 'MANAGER_APPROVAL_CODE_LOCKOUT_MINUTES', 15) *
        MILLISECONDS_PER_MINUTE,
      resetOnSuccess: true
    }),
    registerPolicy: ApprovalThrottlePolicy.create({
      maxFailures: parsePositiveInteger(source, 'MANAGER_APPROVAL_REGISTER_MAX_FAILURES', 10),
      windowMs:
        parsePositiveInteger(source, 'MANAGER_APPROVAL_REGISTER_WINDOW_MINUTES', 15) *
        MILLISECONDS_PER_MINUTE,
      lockoutMs:
        parsePositiveInteger(source, 'MANAGER_APPROVAL_REGISTER_LOCKOUT_MINUTES', 15) *
        MILLISECONDS_PER_MINUTE,
      resetOnSuccess: false
    })
  };
}

function parsePositiveInteger(
  source: NodeJS.ProcessEnv,
  label: string,
  fallbackValue: number
): number {
  const rawValue = source[label];

  if (rawValue === undefined || rawValue.trim() === '') {
    return fallbackValue;
  }

  if (!/^\d+$/.test(rawValue.trim())) {
    throw new Error(`${label} must be a positive integer`);
  }

  const parsedValue = Number.parseInt(rawValue, 10);

  // Minutes are converted to milliseconds, so keep the result a safe integer.
  if (!Number.isSafeInteger(parsedValue * MILLISECONDS_PER_MINUTE) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return parsedValue;
}
