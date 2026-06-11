import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddManagementCashReconciliationTables1763769600000
  implements MigrationInterface
{
  name = 'AddManagementCashReconciliationTables1763769600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "financial_entries"
      ADD COLUMN "sessionId" uuid
    `);
    await queryRunner.query(`
      ALTER TABLE "financial_entries"
      ADD COLUMN "registerId" varchar(64)
    `);
    await queryRunner.query(`
      ALTER TABLE "financial_entries"
      ADD COLUMN "operatorId" uuid
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_financial_entries_tenant_session_payment"
      ON "financial_entries" ("tenantId", "sessionId", "paymentMethod")
    `);

    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "eventId" uuid NOT NULL,
        "eventName" varchar(128) NOT NULL,
        "aggregateId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "processedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_management_processed_events_id" PRIMARY KEY ("eventId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_processed_events_tenant_name"
      ON "processed_events" ("tenantId", "eventName")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_processed_events_tenant_aggregate_name"
      ON "processed_events" ("tenantId", "aggregateId", "eventName")
    `);

    await queryRunner.query(`
      CREATE TABLE "cash_reconciliations" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "sourceEventId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "registerId" varchar(64) NOT NULL,
        "operatorId" uuid NOT NULL,
        "businessDate" date NOT NULL,
        "openingFloatAmount" numeric(12,2) NOT NULL,
        "declaredCashAmount" numeric(12,2) NOT NULL,
        "expectedCashAmount" numeric(12,2) NOT NULL,
        "differenceAmount" numeric(12,2) NOT NULL,
        "status" varchar(16) NOT NULL,
        "closedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_cash_reconciliations_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_cash_reconciliations_source_event_id"
      ON "cash_reconciliations" ("sourceEventId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_cash_reconciliations_tenant_session"
      ON "cash_reconciliations" ("tenantId", "sessionId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_cash_reconciliations_tenant_business_date"
      ON "cash_reconciliations" ("tenantId", "businessDate")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_cash_reconciliations_tenant_business_date"');
    await queryRunner.query('DROP INDEX "uq_cash_reconciliations_tenant_session"');
    await queryRunner.query('DROP INDEX "uq_cash_reconciliations_source_event_id"');
    await queryRunner.query('DROP TABLE "cash_reconciliations"');
    await queryRunner.query('DROP INDEX "idx_processed_events_tenant_aggregate_name"');
    await queryRunner.query('DROP INDEX "idx_processed_events_tenant_name"');
    await queryRunner.query('DROP TABLE "processed_events"');
    await queryRunner.query('DROP INDEX "idx_financial_entries_tenant_session_payment"');
    await queryRunner.query('ALTER TABLE "financial_entries" DROP COLUMN "operatorId"');
    await queryRunner.query('ALTER TABLE "financial_entries" DROP COLUMN "registerId"');
    await queryRunner.query('ALTER TABLE "financial_entries" DROP COLUMN "sessionId"');
  }
}
