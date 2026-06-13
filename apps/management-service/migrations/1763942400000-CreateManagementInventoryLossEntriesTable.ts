import type { MigrationInterface, QueryRunner } from 'typeorm';
import { Table, TableIndex } from 'typeorm';

export class CreateManagementInventoryLossEntriesTable1763942400000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'inventory_loss_entries',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true
          },
          {
            name: 'tenantId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'sourceEventId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'lossId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'productId',
            type: 'uuid',
            isNullable: false
          },
          {
            name: 'barcode',
            type: 'varchar',
            length: '64',
            isNullable: false
          },
          {
            name: 'name',
            type: 'varchar',
            length: '120',
            isNullable: false
          },
          {
            name: 'unitOfMeasure',
            type: 'varchar',
            length: '16',
            isNullable: false
          },
          {
            name: 'quantity',
            type: 'integer',
            isNullable: false
          },
          {
            name: 'reasonCode',
            type: 'varchar',
            length: '32',
            isNullable: false
          },
          {
            name: 'notes',
            type: 'varchar',
            length: '255',
            isNullable: true
          },
          {
            name: 'businessDate',
            type: 'date',
            isNullable: false
          },
          {
            name: 'unitPrice',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false
          },
          {
            name: 'totalLossAmount',
            type: 'numeric',
            precision: 12,
            scale: 2,
            isNullable: false
          },
          {
            name: 'occurredAt',
            type: 'timestamptz',
            isNullable: false
          },
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false
          }
        ]
      })
    );

    await queryRunner.createIndices('inventory_loss_entries', [
      new TableIndex({
        name: 'uq_inventory_loss_entries_source_event_id',
        columnNames: ['sourceEventId'],
        isUnique: true
      }),
      new TableIndex({
        name: 'idx_inventory_loss_entries_tenant_business_date',
        columnNames: ['tenantId', 'businessDate']
      })
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('inventory_loss_entries');
  }
}
