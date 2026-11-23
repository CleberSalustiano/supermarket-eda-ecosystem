import { DomainValidationError } from '@supermarket/shared-domain';
import type { ManagerApprovalOutcome } from '@supermarket/shared-domain';

export const MANAGER_APPROVAL_DENIAL_REASONS = [
  'UNKNOWN_CODE',
  'WRONG_PIN',
  'INACTIVE',
  'NOT_APPROVER'
] as const;

export const MANAGER_APPROVAL_LOCK_REASONS = ['CODE_LOCKED', 'REGISTER_LOCKED'] as const;

export type ManagerApprovalDenialReason = (typeof MANAGER_APPROVAL_DENIAL_REASONS)[number];

export type ManagerApprovalLockReason = (typeof MANAGER_APPROVAL_LOCK_REASONS)[number];

export type ManagerApprovalAttemptReason = ManagerApprovalDenialReason | ManagerApprovalLockReason;

export interface ManagerApprovalAttemptPrimitives {
  id: string;
  tenantId: string;
  approverCode: string;
  employeeId: string | null;
  registerId: string;
  saleId: string;
  outcome: ManagerApprovalOutcome;
  reason: ManagerApprovalAttemptReason | null;
  attemptedAt: string;
}

interface RecordManagerApprovalAttemptInput {
  id: string;
  tenantId: string;
  approverCode: string;
  employeeId: string | null;
  registerId: string;
  saleId: string;
  outcome: ManagerApprovalOutcome;
  reason: ManagerApprovalAttemptReason | null;
  attemptedAt: Date;
}

/**
 * Append-only audit record of one manager approval verification.
 * The reason is internal audit data and is never returned to the caller.
 * It never carries a PIN or a PIN hash.
 */
export class ManagerApprovalAttempt {
  private constructor(private readonly state: ManagerApprovalAttemptPrimitives) {}

  static record(input: RecordManagerApprovalAttemptInput): ManagerApprovalAttempt {
    for (const [label, value] of [
      ['Approval attempt id', input.id],
      ['Tenant id', input.tenantId],
      ['Register id', input.registerId],
      ['Sale id', input.saleId]
    ] as const) {
      if (value.trim().length === 0) {
        throw new DomainValidationError(`${label} cannot be empty`);
      }
    }

    assertReasonMatchesOutcome(input.outcome, input.reason);

    return new ManagerApprovalAttempt({
      id: input.id,
      tenantId: input.tenantId,
      approverCode: input.approverCode.trim().toUpperCase(),
      employeeId: input.employeeId,
      registerId: input.registerId,
      saleId: input.saleId,
      outcome: input.outcome,
      reason: input.reason,
      attemptedAt: input.attemptedAt.toISOString()
    });
  }

  toPrimitives(): ManagerApprovalAttemptPrimitives {
    return { ...this.state };
  }
}

function assertReasonMatchesOutcome(
  outcome: ManagerApprovalOutcome,
  reason: ManagerApprovalAttemptReason | null
): void {
  const isValid =
    outcome === 'APPROVED'
      ? reason === null
      : outcome === 'DENIED'
        ? (MANAGER_APPROVAL_DENIAL_REASONS as readonly string[]).includes(reason ?? '')
        : (MANAGER_APPROVAL_LOCK_REASONS as readonly string[]).includes(reason ?? '');

  if (!isValid) {
    throw new DomainValidationError('Approval attempt reason does not match its outcome');
  }
}
