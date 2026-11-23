import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { ApprovalThrottleScope } from '#/domain/entities/approval-throttle.entity';

@Entity('manager_approval_throttles')
export class ApprovalThrottleTypeormEntity {
  @PrimaryColumn('uuid')
  tenantId!: string;

  @PrimaryColumn('varchar', { length: 16 })
  scope!: ApprovalThrottleScope;

  @PrimaryColumn('varchar', { length: 64 })
  subject!: string;

  @Column('integer', { default: 0 })
  failureCount!: number;

  @Column('timestamptz', { nullable: true })
  windowStartedAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  lockedUntil!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
