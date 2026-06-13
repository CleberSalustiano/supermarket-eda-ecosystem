import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('physical_inventory_adjustments')
@Index('idx_physical_inventory_adjustments_tenant_product', ['tenantId', 'productId'])
export class PhysicalInventoryAdjustmentTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  productId!: string;

  @Column('uuid')
  collectorId!: string;

  @Column('integer')
  previousOnHandQuantity!: number;

  @Column('integer')
  countedQuantity!: number;

  @Column('integer')
  quantityDelta!: number;

  @Column('integer')
  minimumThreshold!: number;

  @Column('varchar', { length: 255 })
  reason!: string;

  @Column('timestamptz')
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
