import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Equivalent default (CURRENT_TIMESTAMP is now()), rewritten in the form TypeORM's
 * CreateDateColumn expects so that schema comparison reports no drift.
 */
export class NormalizeInventoryLossEntriesCreatedAtDefault1764201600000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "inventory_loss_entries" ALTER COLUMN "createdAt" SET DEFAULT now()'
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "inventory_loss_entries" ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP'
    );
  }
}
