import type { ManagerApprovalAttempt } from '../entities/manager-approval-attempt.entity';

export interface ManagerApprovalAttemptRepositoryPort {
  append(attempt: ManagerApprovalAttempt): Promise<void>;
}
