/**
 * Internal service-to-service contract used by checkout-service to ask
 * management-service whether an approver code + PIN authorizes a
 * post-payment sale cancellation.
 *
 * The route is protected by an internal API bearer token and is never exposed
 * through browser CORS.
 */
export const MANAGER_APPROVAL_VERIFICATION_PATH = '/internal/manager-approvals/verifications';

export const MANAGER_APPROVAL_OUTCOMES = ['APPROVED', 'DENIED', 'LOCKED'] as const;

export type ManagerApprovalOutcome = (typeof MANAGER_APPROVAL_OUTCOMES)[number];

export interface ManagerApprovalVerificationRequest {
  /** UUID v4. */
  tenantId: string;
  /** 2 to 32 characters, compared upper-cased. */
  approverCode: string;
  /** Matches `/^\d{4,12}$/`. Never logged or persisted outside management's hash. */
  pin: string;
  /** 1 to 64 characters (checkout register id). */
  registerId: string;
  /** UUID v4. */
  saleId: string;
}

export interface ManagerApprovalApprover {
  employeeId: string;
  employeeCode: string;
  fullName: string;
}

export interface ManagerApprovalVerificationResponse {
  outcome: ManagerApprovalOutcome;
  /** Non-null only when `outcome === 'APPROVED'`. */
  approver: ManagerApprovalApprover | null;
}

export function isManagerApprovalVerificationResponse(
  value: unknown
): value is ManagerApprovalVerificationResponse {
  if (!isRecord(value) || !isManagerApprovalOutcome(value['outcome'])) {
    return false;
  }

  if (value['outcome'] === 'APPROVED') {
    return isManagerApprovalApprover(value['approver']);
  }

  return value['approver'] === null;
}

function isManagerApprovalOutcome(value: unknown): value is ManagerApprovalOutcome {
  return (
    typeof value === 'string' &&
    (MANAGER_APPROVAL_OUTCOMES as readonly string[]).includes(value)
  );
}

function isManagerApprovalApprover(value: unknown): value is ManagerApprovalApprover {
  return (
    isRecord(value) &&
    isNonEmptyString(value['employeeId']) &&
    isNonEmptyString(value['employeeCode']) &&
    isNonEmptyString(value['fullName'])
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
