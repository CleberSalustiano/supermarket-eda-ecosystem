import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';

import { SaleTypeormEntity } from './sale.typeorm-entity';
import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('sale_items')
@Index('idx_sale_items_sale', ['saleId'])
export class SaleItemTypeormEntity {
  @PrimaryColumn('uuid')
  saleId!: string;

  @PrimaryColumn('uuid')
  productId!: string;

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

  @Column('integer')
  quantity!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  lineTotal!: number;

  @ManyToOne(() => SaleTypeormEntity, (sale) => sale.items, {
    onDelete: 'CASCADE'
  })
  @JoinColumn({ name: 'saleId', referencedColumnName: 'id' })
  sale!: SaleTypeormEntity;
}
