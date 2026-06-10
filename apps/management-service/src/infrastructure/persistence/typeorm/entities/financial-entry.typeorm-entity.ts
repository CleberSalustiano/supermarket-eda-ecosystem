import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn
} from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('financial_entries')
@Index('uq_financial_entries_source_event_id', ['sourceEventId'], {
  unique: true
})
@Index('idx_financial_entries_tenant_business_date', ['tenantId', 'businessDate'])
export class FinancialEntryTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 32 })
  entryType!: string;

  @Column('uuid')
  sourceEventId!: string;

  @Column('uuid')
  saleId!: string;

  @Column('varchar', { length: 16 })
  paymentMethod!: string;

  @Column('date')
  businessDate!: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  grossAmount!: number;

  @Column('integer')
  totalItemsQuantity!: number;

  @Column('timestamptz')
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
