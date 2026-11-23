import type { EmployeeAuditEntry } from '../entities/employee-audit-entry.entity';

export interface EmployeeAuditEntryRepositoryPort {
  append(entry: EmployeeAuditEntry): Promise<void>;
}
