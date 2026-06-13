import { Column, Entity, Index, PrimaryColumn } from 'typeorm';

import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('supplier_invoice_lines')
@Index('idx_supplier_invoice_lines_invoice_id', ['invoiceId'])
export class SupplierInvoiceLineTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  invoiceId!: string;

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

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  unitCost!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  lineCost!: number;
}
