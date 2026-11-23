import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSaleCancellationApprover1764374400000 implements MigrationInterface {
  name = 'AddSaleCancellationApprover1764374400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD COLUMN "cancellationApprovedByEmployeeId" uuid,
      ADD COLUMN "cancellationApprovedByEmployeeCode" character varying(32),
      ADD COLUMN "cancellationApprovedByFullName" character varying(120)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales"
      DROP COLUMN "cancellationApprovedByFullName",
      DROP COLUMN "cancellationApprovedByEmployeeCode",
      DROP COLUMN "cancellationApprovedByEmployeeId"
    `);
  }
}
