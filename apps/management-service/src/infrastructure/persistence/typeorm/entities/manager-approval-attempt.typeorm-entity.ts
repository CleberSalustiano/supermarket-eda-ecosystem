import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import type { ManagerApprovalOutcome } from '@supermarket/shared-domain';

import type { ManagerApprovalAttemptReason } from '#/domain/entities/manager-approval-attempt.entity';

@Entity('manager_approval_attempts')
@Index('idx_manager_approval_attempts_tenant_code_time', ['tenantId', 'approverCode', 'attemptedAt'])
@Index('idx_manager_approval_attempts_tenant_register_time', [
  'tenantId',
  'registerId',
  'attemptedAt'
])
export class ManagerApprovalAttemptTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 32 })
  approverCode!: string;

  @Column('uuid', { nullable: true })
  employeeId!: string | null;

  @Column('varchar', { length: 64 })
  registerId!: string;

  @Column('uuid')
  saleId!: string;

  @Column('varchar', { length: 16 })
  outcome!: ManagerApprovalOutcome;

  @Column('varchar', { length: 32, nullable: true })
  reason!: ManagerApprovalAttemptReason | null;

  @Column('timestamptz')
  attemptedAt!: Date;
}
