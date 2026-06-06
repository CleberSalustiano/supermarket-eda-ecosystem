import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { EmployeeRole } from '@supermarket/shared-domain';

@Entity('employees')
@Index('uq_employees_tenant_code', ['tenantId', 'employeeCode'], { unique: true })
export class EmployeeTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('varchar', { length: 32 })
  employeeCode!: string;

  @Column('varchar', { length: 120 })
  fullName!: string;

  @Column('varchar', { length: 16 })
  role!: EmployeeRole;

  @Column('varchar', { length: 255 })
  pinHash!: string;

  @Column('boolean', { default: true })
  active!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
