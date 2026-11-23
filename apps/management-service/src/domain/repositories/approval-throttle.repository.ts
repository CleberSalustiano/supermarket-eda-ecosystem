import type {
  ApprovalThrottle,
  ApprovalThrottleScope
} from '../entities/approval-throttle.entity';

export interface ApprovalThrottleRepositoryPort {
  /**
   * Creates the throttle row when it does not exist yet and returns it under a
   * row lock held until the surrounding transaction ends.
   */
  findForUpdate(
    tenantId: string,
    scope: ApprovalThrottleScope,
    subject: string
  ): Promise<ApprovalThrottle>;
  save(throttle: ApprovalThrottle): Promise<void>;
  /** Resets the counters and lifts any lockout; a missing row is a no-op. */
  clear(tenantId: string, scope: ApprovalThrottleScope, subject: string): Promise<void>;
}
