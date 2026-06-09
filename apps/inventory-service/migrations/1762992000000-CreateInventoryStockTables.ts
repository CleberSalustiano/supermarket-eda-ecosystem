import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInventoryStockTables1762992000000 implements MigrationInterface {
  name = 'CreateInventoryStockTables1762992000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "inventory_items" (
        "productId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "barcode" character varying(64) NOT NULL,
        "name" character varying(120) NOT NULL,
        "unitOfMeasure" character varying(16) NOT NULL,
        "onHandQuantity" integer NOT NULL,
        "minimumThreshold" integer NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_inventory_items_product_id" PRIMARY KEY ("productId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_inventory_items_tenant_barcode"
      ON "inventory_items" ("tenantId", "barcode")
    `);
    await queryRunner.query(`
      CREATE TABLE "stock_movements" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "movementType" character varying(32) NOT NULL,
        "quantityDelta" integer NOT NULL,
        "referenceId" uuid NOT NULL,
        "referenceEventId" uuid NOT NULL,
        "reason" character varying(96) NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_stock_movements_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_stock_movements_tenant_product"
      ON "stock_movements" ("tenantId", "productId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_stock_movements_reference_event"
      ON "stock_movements" ("referenceEventId")
    `);
    await queryRunner.query(`
      CREATE TABLE "processed_events" (
        "eventId" uuid NOT NULL,
        "eventName" character varying(128) NOT NULL,
        "aggregateId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "processedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_processed_events_event_id" PRIMARY KEY ("eventId")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_processed_events_tenant_name"
      ON "processed_events" ("tenantId", "eventName")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_processed_events_tenant_name"`);
    await queryRunner.query(`DROP TABLE "processed_events"`);
    await queryRunner.query(`DROP INDEX "public"."idx_stock_movements_reference_event"`);
    await queryRunner.query(`DROP INDEX "public"."idx_stock_movements_tenant_product"`);
    await queryRunner.query(`DROP TABLE "stock_movements"`);
    await queryRunner.query(`DROP INDEX "public"."idx_inventory_items_tenant_barcode"`);
    await queryRunner.query(`DROP TABLE "inventory_items"`);
  }
}
