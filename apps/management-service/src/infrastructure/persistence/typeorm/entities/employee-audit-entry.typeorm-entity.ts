import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { EmployeeAuditAction } from '#/domain/entities/employee-audit-entry.entity';

@Entity('employee_audit_entries')
@Index('idx_employee_audit_entries_tenant_employee', ['tenantId', 'employeeId', 'occurredAt'])
export class EmployeeAuditEntryTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  employeeId!: string;

  @Column('varchar', { length: 32 })
  employeeCode!: string;

  @Column('varchar', { length: 16 })
  action!: EmployeeAuditAction;

  @Column('timestamptz')
  occurredAt!: Date;
}
