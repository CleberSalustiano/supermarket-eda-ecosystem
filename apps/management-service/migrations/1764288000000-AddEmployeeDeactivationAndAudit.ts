import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableColumn, TableIndex } from 'typeorm';

export class AddEmployeeDeactivationAndAudit1764288000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'employees',
      new TableColumn({
        name: 'deactivatedAt',
        type: 'timestamptz',
        isNullable: true
      })
    );

    await queryRunner.createTable(
      new Table({
        name: 'employee_audit_entries',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenantId', type: 'uuid', isNullable: false },
          { name: 'employeeId', type: 'uuid', isNullable: false },
          { name: 'employeeCode', type: 'varchar', length: '32', isNullable: false },
          { name: 'action', type: 'varchar', length: '16', isNullable: false },
          { name: 'occurredAt', type: 'timestamptz', isNullable: false }
        ]
      })
    );

    await queryRunner.createIndex(
      'employee_audit_entries',
      new TableIndex({
        name: 'idx_employee_audit_entries_tenant_employee',
        columnNames: ['tenantId', 'employeeId', 'occurredAt']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('employee_audit_entries');
    await queryRunner.dropColumn('employees', 'deactivatedAt');
  }
}
