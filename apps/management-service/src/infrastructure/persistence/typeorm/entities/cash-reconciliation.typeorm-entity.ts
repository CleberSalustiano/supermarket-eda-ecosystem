import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('cash_reconciliations')
@Index('uq_cash_reconciliations_source_event_id', ['sourceEventId'], {
  unique: true
})
@Index('uq_cash_reconciliations_tenant_session', ['tenantId', 'sessionId'], {
  unique: true
})
@Index('idx_cash_reconciliations_tenant_business_date', ['tenantId', 'businessDate'])
export class CashReconciliationTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  sourceEventId!: string;

  @Column('uuid')
  sessionId!: string;

  @Column('varchar', { length: 64 })
  registerId!: string;

  @Column('uuid')
  operatorId!: string;

  @Column('date')
  businessDate!: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  openingFloatAmount!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  declaredCashAmount!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  expectedCashAmount!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  differenceAmount!: number;

  @Column('varchar', { length: 16 })
  status!: string;

  @Column('timestamptz')
  closedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
