import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('daily_financial_consolidations')
export class DailyFinancialConsolidationTypeormEntity {
  @PrimaryColumn('uuid')
  tenantId!: string;

  @PrimaryColumn('date')
  businessDate!: string;

  @Column('numeric', {
    precision: 14,
    scale: 2,
    default: 0,
    transformer: decimalColumnTransformer
  })
  grossSalesTotal!: number;

  @Column('integer', { default: 0 })
  salesCount!: number;

  @Column('integer', { default: 0 })
  soldItemsQuantity!: number;

  @Column('timestamptz')
  lastConsolidatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
