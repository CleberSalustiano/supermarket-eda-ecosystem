import { Column, Entity, ForeignKey, Index, PrimaryColumn } from 'typeorm';

import { SupplierInvoiceTypeormEntity } from './supplier-invoice.typeorm-entity';
import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('supplier_invoice_lines')
@ForeignKey(() => SupplierInvoiceTypeormEntity, ['invoiceId'], ['id'], {
  name: 'fk_supplier_invoice_lines_invoice_id',
  onDelete: 'CASCADE'
})
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
