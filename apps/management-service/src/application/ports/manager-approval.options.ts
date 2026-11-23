import type { ApprovalThrottlePolicy } from '#/domain/value-objects/approval-throttle-policy';

export const MANAGER_APPROVAL_OPTIONS = Symbol('MANAGER_APPROVAL_OPTIONS');

export interface ManagerApprovalOptions {
  /** Per `(tenantId, approver code)`; a success resets the counter. */
  approverCodePolicy: ApprovalThrottlePolicy;
  /** Per `(tenantId, registerId)`; a success never resets the counter. */
  registerPolicy: ApprovalThrottlePolicy;
}
