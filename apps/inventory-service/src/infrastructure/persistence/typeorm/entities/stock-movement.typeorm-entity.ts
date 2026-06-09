import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('stock_movements')
@Index('idx_stock_movements_tenant_product', ['tenantId', 'productId'])
@Index('idx_stock_movements_reference_event', ['referenceEventId'])
export class StockMovementTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  productId!: string;

  @Column('varchar', { length: 32 })
  movementType!: string;

  @Column('integer')
  quantityDelta!: number;

  @Column('uuid')
  referenceId!: string;

  @Column('uuid')
  referenceEventId!: string;

  @Column('varchar', { length: 96 })
  reason!: string;

  @Column('timestamptz')
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
