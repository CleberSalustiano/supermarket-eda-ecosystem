import type {
  ManagerApprovalVerificationRequest,
  ManagerApprovalVerificationResponse
} from '@supermarket/shared-domain';

export interface ManagerApprovalVerificationContext {
  correlationId?: string;
}

/**
 * Asks management-service whether an approver code + PIN authorizes a
 * post-payment sale cancellation.
 *
 * Implementations make exactly one attempt (a retry could count a failed
 * attempt twice against the lockouts) and throw `DependencyUnavailableError`
 * when management is unreachable, times out, answers with a non-200 status or
 * returns a body that violates the contract.
 */
export interface ManagerApprovalVerifierPort {
  verify(
    request: ManagerApprovalVerificationRequest,
    context: ManagerApprovalVerificationContext
  ): Promise<ManagerApprovalVerificationResponse>;
}

export const MANAGER_APPROVAL_VERIFIER = Symbol('MANAGER_APPROVAL_VERIFIER');

/** The message of the `DependencyUnavailableError` (503) for every verification failure. */
export const MANAGER_APPROVAL_UNAVAILABLE_MESSAGE =
  'Manager approval is unavailable; the sale was not canceled';
