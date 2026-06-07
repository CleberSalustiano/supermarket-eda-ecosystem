import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('product_catalog_items')
@Index('uq_product_catalog_items_tenant_barcode', ['tenantId', 'barcode'], {
  unique: true
})
export class ProductCatalogItemTypeormEntity {
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

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  unitPrice!: number;

  @Column('boolean', { default: true })
  active!: boolean;

  @Column('timestamptz')
  priceUpdatedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
