import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('pos_sessions')
@Index('idx_pos_sessions_tenant_register', ['tenantId', 'registerId'])
export class PosSessionTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 64 })
  registerId!: string;

  @Column('uuid')
  operatorId!: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  openingFloatAmount!: number;

  @Column('varchar', { length: 16 })
  status!: string;

  @Column('timestamptz')
  openedAt!: Date;

  @Column('timestamptz', { nullable: true })
  closedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
