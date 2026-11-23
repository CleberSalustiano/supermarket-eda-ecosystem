import { DomainValidationError } from '@supermarket/shared-domain';

export type EmployeeAuditAction = 'REGISTERED' | 'DEACTIVATED' | 'PIN_CHANGED';

export interface EmployeeAuditEntryPrimitives {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeCode: string;
  action: EmployeeAuditAction;
  occurredAt: string;
}

interface RecordEmployeeAuditEntryInput {
  id: string;
  tenantId: string;
  employeeId: string;
  employeeCode: string;
  action: EmployeeAuditAction;
  occurredAt?: Date;
}

/**
 * Append-only audit record of an employee lifecycle change.
 * It never carries a PIN or a PIN hash.
 */
export class EmployeeAuditEntry {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly employeeId: string,
    private readonly employeeCode: string,
    private readonly action: EmployeeAuditAction,
    private readonly occurredAt: Date
  ) {}

  static record(input: RecordEmployeeAuditEntryInput): EmployeeAuditEntry {
    for (const [label, value] of [
      ['Audit entry id', input.id],
      ['Tenant id', input.tenantId],
      ['Employee id', input.employeeId],
      ['Employee code', input.employeeCode]
    ] as const) {
      if (value.trim().length === 0) {
        throw new DomainValidationError(`${label} cannot be empty`);
      }
    }

    return new EmployeeAuditEntry(
      input.id,
      input.tenantId,
      input.employeeId,
      input.employeeCode,
      input.action,
      input.occurredAt ?? new Date()
    );
  }

  toPrimitives(): EmployeeAuditEntryPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      employeeId: this.employeeId,
      employeeCode: this.employeeCode,
      action: this.action,
      occurredAt: this.occurredAt.toISOString()
    };
  }
}
