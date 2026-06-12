import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInventoryLossAndOutboxTables1763856000000 implements MigrationInterface {
  name = 'AddInventoryLossAndOutboxTables1763856000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory_losses" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "quantity" integer NOT NULL,
        "reasonCode" character varying(32) NOT NULL,
        "notes" character varying(255),
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_inventory_losses_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_inventory_losses_tenant_product"
      ON "inventory_losses" ("tenantId", "productId")
    `);

    await queryRunner.query(`
      CREATE TABLE "outbox_events" (
        "id" uuid NOT NULL,
        "eventName" character varying(128) NOT NULL,
        "topic" character varying(160) NOT NULL,
        "aggregateId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "payload" jsonb NOT NULL,
        "attempts" integer NOT NULL DEFAULT 0,
        "failureReason" text,
        "publishedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_inventory_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "outbox_events"');
    await queryRunner.query('DROP INDEX "public"."idx_inventory_losses_tenant_product"');
    await queryRunner.query('DROP TABLE "inventory_losses"');
  }
}
