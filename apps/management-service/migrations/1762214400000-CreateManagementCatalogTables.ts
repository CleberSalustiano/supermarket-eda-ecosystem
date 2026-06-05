import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateManagementCatalogTables1762214400000 implements MigrationInterface {
  name = 'CreateManagementCatalogTables1762214400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "products" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "name" varchar(120) NOT NULL,
        "barcode" varchar(64) NOT NULL,
        "unitOfMeasure" varchar(16) NOT NULL,
        "currentPrice" numeric(12,2) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_products_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_products_tenant_barcode"
      ON "products" ("tenantId", "barcode")
    `);

    await queryRunner.query(`
      CREATE TABLE "employees" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "employeeCode" varchar(32) NOT NULL,
        "fullName" varchar(120) NOT NULL,
        "role" varchar(16) NOT NULL,
        "pinHash" varchar(255) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_employees_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_employees_tenant_code"
      ON "employees" ("tenantId", "employeeCode")
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL,
        "eventName" varchar(128) NOT NULL,
        "topic" varchar(160) NOT NULL,
        "aggregateId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "occurredAt" timestamptz NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "failureReason" text,
        "publishedAt" timestamptz,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_outbox_events_published_at"
      ON "outbox_events" ("publishedAt")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_outbox_events_published_at"');
    await queryRunner.query('DROP TABLE "outbox_events"');
    await queryRunner.query('DROP INDEX "uq_employees_tenant_code"');
    await queryRunner.query('DROP TABLE "employees"');
    await queryRunner.query('DROP INDEX "uq_products_tenant_barcode"');
    await queryRunner.query('DROP TABLE "products"');
  }
}
