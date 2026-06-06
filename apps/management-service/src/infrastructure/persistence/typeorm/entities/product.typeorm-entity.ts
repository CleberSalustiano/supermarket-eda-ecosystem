import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('products')
@Index('uq_products_tenant_barcode', ['tenantId', 'barcode'], { unique: true })
export class ProductTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 120 })
  name!: string;

  @Column('varchar', { length: 64 })
  barcode!: string;

  @Column('varchar', { length: 16 })
  unitOfMeasure!: string;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  currentPrice!: number;

  @Column('boolean', { default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
