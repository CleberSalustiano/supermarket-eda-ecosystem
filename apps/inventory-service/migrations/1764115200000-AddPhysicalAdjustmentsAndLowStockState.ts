import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhysicalAdjustmentsAndLowStockState1764115200000
  implements MigrationInterface
{
  name = 'AddPhysicalAdjustmentsAndLowStockState1764115200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      ADD COLUMN "lastLowStockAlertAt" TIMESTAMPTZ
    `);

    await queryRunner.query(`
      CREATE TABLE "physical_inventory_adjustments" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "collectorId" uuid NOT NULL,
        "previousOnHandQuantity" integer NOT NULL,
        "countedQuantity" integer NOT NULL,
        "quantityDelta" integer NOT NULL,
        "minimumThreshold" integer NOT NULL,
        "reason" character varying(255) NOT NULL,
        "occurredAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_physical_inventory_adjustments_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_physical_inventory_adjustments_tenant_product"
      ON "physical_inventory_adjustments" ("tenantId", "productId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_physical_inventory_adjustments_tenant_product"`
    );
    await queryRunner.query(`DROP TABLE "physical_inventory_adjustments"`);
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      DROP COLUMN "lastLowStockAlertAt"
    `);
  }
}
