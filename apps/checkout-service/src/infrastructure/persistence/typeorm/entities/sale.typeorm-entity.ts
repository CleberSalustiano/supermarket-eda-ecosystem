import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn
} from 'typeorm';

import { SaleItemTypeormEntity } from './sale-item.typeorm-entity';
import { decimalColumnTransformer } from './decimal-column.transformer';

@Entity('sales')
@Index('idx_sales_tenant_session', ['tenantId', 'sessionId'])
export class SaleTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('uuid')
  sessionId!: string;

  @Column('varchar', { length: 16 })
  status!: string;

  @Column('varchar', { length: 32, nullable: true })
  paymentMethod!: string | null;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalColumnTransformer
  })
  paidAmount!: number | null;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    nullable: true,
    transformer: decimalColumnTransformer
  })
  changeAmount!: number | null;

  @Column('timestamptz', { nullable: true })
  paidAt!: Date | null;

  @Column('timestamptz', { nullable: true })
  completedAt!: Date | null;

  @Column('integer')
  totalItemsQuantity!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  subtotal!: number;

  @Column('numeric', {
    precision: 12,
    scale: 2,
    transformer: decimalColumnTransformer
  })
  total!: number;

  @OneToMany(() => SaleItemTypeormEntity, (item) => item.sale, {
    eager: true
  })
  items!: SaleItemTypeormEntity[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
