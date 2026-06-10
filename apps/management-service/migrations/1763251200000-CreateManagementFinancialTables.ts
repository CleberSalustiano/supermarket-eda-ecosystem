import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateManagementFinancialTables1763251200000 implements MigrationInterface {
  name = 'CreateManagementFinancialTables1763251200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "financial_entries" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "entryType" varchar(32) NOT NULL,
        "sourceEventId" uuid NOT NULL,
        "saleId" uuid NOT NULL,
        "paymentMethod" varchar(16) NOT NULL,
        "businessDate" date NOT NULL,
        "grossAmount" numeric(12,2) NOT NULL,
        "totalItemsQuantity" integer NOT NULL,
        "occurredAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_financial_entries_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_financial_entries_source_event_id"
      ON "financial_entries" ("sourceEventId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_financial_entries_tenant_business_date"
      ON "financial_entries" ("tenantId", "businessDate")
    `);

    await queryRunner.query(`
      CREATE TABLE "daily_financial_consolidations" (
        "tenantId" uuid NOT NULL,
        "businessDate" date NOT NULL,
        "grossSalesTotal" numeric(14,2) NOT NULL DEFAULT 0,
        "salesCount" integer NOT NULL DEFAULT 0,
        "soldItemsQuantity" integer NOT NULL DEFAULT 0,
        "lastConsolidatedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_daily_financial_consolidations"
          PRIMARY KEY ("tenantId", "businessDate")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "daily_financial_consolidations"');
    await queryRunner.query('DROP INDEX "idx_financial_entries_tenant_business_date"');
    await queryRunner.query('DROP INDEX "uq_financial_entries_source_event_id"');
    await queryRunner.query('DROP TABLE "financial_entries"');
  }
}
