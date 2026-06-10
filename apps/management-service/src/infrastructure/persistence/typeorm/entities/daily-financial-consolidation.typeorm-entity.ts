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
    transformer: decimalColumnTransformer
  })
  grossSalesTotal!: number;

  @Column('integer')
  salesCount!: number;

  @Column('integer')
  soldItemsQuantity!: number;

  @Column('timestamptz')
  lastConsolidatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
