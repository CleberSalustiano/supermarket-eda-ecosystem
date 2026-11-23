import { DomainValidationError } from '@supermarket/shared-domain';

interface ApprovalThrottlePolicyInput {
  maxFailures: number;
  windowMs: number;
  lockoutMs: number;
  resetOnSuccess: boolean;
}

/**
 * Lockout rule applied to one approval throttle scope: `maxFailures` failures
 * within `windowMs` lock the subject for `lockoutMs`. `resetOnSuccess` decides
 * whether a successful approval clears the failure counter.
 */
export class ApprovalThrottlePolicy {
  private constructor(
    readonly maxFailures: number,
    readonly windowMs: number,
    readonly lockoutMs: number,
    readonly resetOnSuccess: boolean
  ) {}

  static create(input: ApprovalThrottlePolicyInput): ApprovalThrottlePolicy {
    assertPositiveInteger(input.maxFailures, 'Approval throttle max failures');
    assertPositiveInteger(input.windowMs, 'Approval throttle window');
    assertPositiveInteger(input.lockoutMs, 'Approval throttle lockout');

    return new ApprovalThrottlePolicy(
      input.maxFailures,
      input.windowMs,
      input.lockoutMs,
      input.resetOnSuccess
    );
  }
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }
}
