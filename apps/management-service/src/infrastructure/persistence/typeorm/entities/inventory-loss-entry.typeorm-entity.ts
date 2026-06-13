import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn
} from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('inventory_loss_entries')
@Index('uq_inventory_loss_entries_source_event_id', ['sourceEventId'], {
  unique: true
})
@Index('idx_inventory_loss_entries_tenant_business_date', ['tenantId', 'businessDate'])
export class InventoryLossEntryTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  sourceEventId!: string;

  @Column('uuid')
  lossId!: string;

  @Column('uuid')
  productId!: string;

  @Column('varchar', { length: 64 })
  barcode!: string;

  @Column('varchar', { length: 120 })
  name!: string;

  @Column('varchar', { length: 16 })
  unitOfMeasure!: string;

  @Column('integer')
  quantity!: number;

  @Column('varchar', { length: 32 })
  reasonCode!: string;

  @Column('varchar', { length: 255, nullable: true })
  notes!: string | null;

  @Column('date')
  businessDate!: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  unitPrice!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  totalLossAmount!: number;

  @Column('timestamptz')
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
