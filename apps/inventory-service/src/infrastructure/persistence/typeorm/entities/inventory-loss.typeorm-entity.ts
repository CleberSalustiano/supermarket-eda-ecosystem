import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('inventory_losses')
@Index('idx_inventory_losses_tenant_product', ['tenantId', 'productId'])
export class InventoryLossTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  productId!: string;

  @Column('integer')
  quantity!: number;

  @Column('varchar', { length: 32 })
  reasonCode!: string;

  @Column('varchar', { length: 255, nullable: true })
  notes!: string | null;

  @Column('timestamptz')
  occurredAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
