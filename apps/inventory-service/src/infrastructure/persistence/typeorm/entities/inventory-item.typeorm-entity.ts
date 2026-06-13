import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('inventory_items')
@Index('idx_inventory_items_tenant_barcode', ['tenantId', 'barcode'])
export class InventoryItemTypeormEntity {
  @PrimaryColumn('uuid')
  productId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 64 })
  barcode!: string;

  @Column('varchar', { length: 120 })
  name!: string;

  @Column('varchar', { length: 16 })
  unitOfMeasure!: string;

  @Column('integer')
  onHandQuantity!: number;

  @Column('integer')
  minimumThreshold!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalColumnTransformer
  })
  averageUnitCost!: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
