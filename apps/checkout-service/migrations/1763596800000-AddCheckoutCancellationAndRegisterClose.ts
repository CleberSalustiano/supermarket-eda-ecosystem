import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckoutCancellationAndRegisterClose1763596800000
  implements MigrationInterface
{
  name = 'AddCheckoutCancellationAndRegisterClose1763596800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "pos_sessions"
      ADD COLUMN "declaredCashAmount" numeric(12,2)
    `);
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD COLUMN "canceledAt" TIMESTAMPTZ,
      ADD COLUMN "cancellationReason" character varying(255)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales"
      DROP COLUMN "cancellationReason",
      DROP COLUMN "canceledAt"
    `);
    await queryRunner.query(`
      ALTER TABLE "pos_sessions"
      DROP COLUMN "declaredCashAmount"
    `);
  }
}
