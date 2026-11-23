import type { Employee } from '../entities/employee.entity';
import type { ManagerApprovalDenialReason } from '../entities/manager-approval-attempt.entity';

export type ManagerApprovalDecision =
  | { outcome: 'APPROVED'; approver: Employee }
  | { outcome: 'DENIED'; reason: ManagerApprovalDenialReason };

/**
 * Decides an approval once the PIN has been checked. Reasons are evaluated in
 * a fixed order: unknown code, wrong PIN, inactive employee, role not allowed.
 */
export function decideManagerApproval(
  employee: Employee | null,
  pinMatches: boolean
): ManagerApprovalDecision {
  if (!employee) {
    return { outcome: 'DENIED', reason: 'UNKNOWN_CODE' };
  }

  if (!pinMatches) {
    return { outcome: 'DENIED', reason: 'WRONG_PIN' };
  }

  if (!employee.isActive()) {
    return { outcome: 'DENIED', reason: 'INACTIVE' };
  }

  if (!employee.canApproveSaleCancellation()) {
    return { outcome: 'DENIED', reason: 'NOT_APPROVER' };
  }

  return { outcome: 'APPROVED', approver: employee };
}
