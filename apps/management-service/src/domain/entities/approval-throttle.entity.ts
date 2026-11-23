import { DomainValidationError } from '@supermarket/shared-domain';

import type { ApprovalThrottlePolicy } from '../value-objects/approval-throttle-policy';

export const APPROVAL_THROTTLE_SCOPES = ['APPROVER_CODE', 'REGISTER'] as const;

export type ApprovalThrottleScope = (typeof APPROVAL_THROTTLE_SCOPES)[number];

export const APPROVAL_THROTTLE_SUBJECT_MAX_LENGTH = 64;

export interface ApprovalThrottlePrimitives {
  tenantId: string;
  scope: ApprovalThrottleScope;
  subject: string;
  failureCount: number;
  windowStartedAt: string | null;
  lockedUntil: string | null;
}

interface OpenApprovalThrottleInput {
  tenantId: string;
  scope: ApprovalThrottleScope;
  subject: string;
}

interface RehydrateApprovalThrottleInput extends OpenApprovalThrottleInput {
  failureCount: number;
  windowStartedAt: Date | null;
  lockedUntil: Date | null;
}

/**
 * Failure counter and lockout state for one `(tenantId, scope, subject)`, used
 * to rate-limit manager approval attempts per approver code and per register.
 */
export class ApprovalThrottle {
  private constructor(
    private readonly tenantId: string,
    private readonly scope: ApprovalThrottleScope,
    private readonly subject: string,
    private failureCount: number,
    private windowStartedAt: Date | null,
    private lockedUntil: Date | null
  ) {}

  static open(input: OpenApprovalThrottleInput): ApprovalThrottle {
    return ApprovalThrottle.rehydrate({
      ...input,
      failureCount: 0,
      windowStartedAt: null,
      lockedUntil: null
    });
  }

  static rehydrate(input: RehydrateApprovalThrottleInput): ApprovalThrottle {
    if (input.tenantId.trim().length === 0) {
      throw new DomainValidationError('Tenant id cannot be empty');
    }

    if (!APPROVAL_THROTTLE_SCOPES.includes(input.scope)) {
      throw new DomainValidationError('Approval throttle scope is not supported');
    }

    if (
      input.subject.length === 0 ||
      input.subject.length > APPROVAL_THROTTLE_SUBJECT_MAX_LENGTH
    ) {
      throw new DomainValidationError(
        `Approval throttle subject must contain between 1 and ${APPROVAL_THROTTLE_SUBJECT_MAX_LENGTH} characters`
      );
    }

    if (!Number.isSafeInteger(input.failureCount) || input.failureCount < 0) {
      throw new DomainValidationError('Approval throttle failure count cannot be negative');
    }

    return new ApprovalThrottle(
      input.tenantId,
      input.scope,
      input.subject,
      input.failureCount,
      input.windowStartedAt,
      input.lockedUntil
    );
  }

  isLocked(now: Date): boolean {
    return this.lockedUntil !== null && now.getTime() < this.lockedUntil.getTime();
  }

  /**
   * Counts one failure. Failures during an active lockout never extend it.
   */
  registerFailure(now: Date, policy: ApprovalThrottlePolicy): void {
    if (this.isLocked(now)) {
      return;
    }

    if (
      this.windowStartedAt === null ||
      now.getTime() - this.windowStartedAt.getTime() >= policy.windowMs
    ) {
      this.windowStartedAt = now;
      this.failureCount = 0;
    }

    this.failureCount += 1;

    if (this.failureCount >= policy.maxFailures) {
      this.lockedUntil = new Date(now.getTime() + policy.lockoutMs);
      this.failureCount = 0;
      this.windowStartedAt = null;
    }
  }

  registerSuccess(policy: ApprovalThrottlePolicy): void {
    if (!policy.resetOnSuccess) {
      return;
    }

    this.failureCount = 0;
    this.windowStartedAt = null;
  }

  clear(): void {
    this.failureCount = 0;
    this.windowStartedAt = null;
    this.lockedUntil = null;
  }

  toPrimitives(): ApprovalThrottlePrimitives {
    return {
      tenantId: this.tenantId,
      scope: this.scope,
      subject: this.subject,
      failureCount: this.failureCount,
      windowStartedAt: this.windowStartedAt?.toISOString() ?? null,
      lockedUntil: this.lockedUntil?.toISOString() ?? null
    };
  }
}
