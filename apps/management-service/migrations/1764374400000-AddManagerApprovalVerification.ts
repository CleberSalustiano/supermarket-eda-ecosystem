import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class AddManagerApprovalVerification1764374400000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'manager_approval_throttles',
        columns: [
          { name: 'tenantId', type: 'uuid', isPrimary: true },
          { name: 'scope', type: 'varchar', length: '16', isPrimary: true },
          { name: 'subject', type: 'varchar', length: '64', isPrimary: true },
          { name: 'failureCount', type: 'integer', isNullable: false, default: 0 },
          { name: 'windowStartedAt', type: 'timestamptz', isNullable: true },
          { name: 'lockedUntil', type: 'timestamptz', isNullable: true },
          { name: 'createdAt', type: 'timestamptz', isNullable: false, default: 'now()' },
          { name: 'updatedAt', type: 'timestamptz', isNullable: false, default: 'now()' }
        ]
      })
    );

    await queryRunner.createTable(
      new Table({
        name: 'manager_approval_attempts',
        columns: [
          { name: 'id', type: 'uuid', isPrimary: true },
          { name: 'tenantId', type: 'uuid', isNullable: false },
          { name: 'approverCode', type: 'varchar', length: '32', isNullable: false },
          { name: 'employeeId', type: 'uuid', isNullable: true },
          { name: 'registerId', type: 'varchar', length: '64', isNullable: false },
          { name: 'saleId', type: 'uuid', isNullable: false },
          { name: 'outcome', type: 'varchar', length: '16', isNullable: false },
          { name: 'reason', type: 'varchar', length: '32', isNullable: true },
          { name: 'attemptedAt', type: 'timestamptz', isNullable: false }
        ]
      })
    );

    await queryRunner.createIndex(
      'manager_approval_attempts',
      new TableIndex({
        name: 'idx_manager_approval_attempts_tenant_code_time',
        columnNames: ['tenantId', 'approverCode', 'attemptedAt']
      })
    );
    await queryRunner.createIndex(
      'manager_approval_attempts',
      new TableIndex({
        name: 'idx_manager_approval_attempts_tenant_register_time',
        columnNames: ['tenantId', 'registerId', 'attemptedAt']
      })
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('manager_approval_attempts');
    await queryRunner.dropTable('manager_approval_throttles');
  }
}
