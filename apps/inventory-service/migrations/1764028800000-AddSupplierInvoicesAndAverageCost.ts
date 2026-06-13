import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddSupplierInvoicesAndAverageCost1764028800000 implements MigrationInterface {
  name = 'AddSupplierInvoicesAndAverageCost1764028800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      ADD COLUMN "averageUnitCost" numeric(12, 2)
    `);

    await queryRunner.query(`
      CREATE TABLE "supplier_invoices" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "supplierReference" character varying(64) NOT NULL,
        "totalItemsQuantity" integer NOT NULL,
        "totalCost" numeric(12, 2) NOT NULL,
        "receivedAt" TIMESTAMPTZ NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "pk_supplier_invoices_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_supplier_invoices_tenant_reference"
      ON "supplier_invoices" ("tenantId", "supplierReference")
    `);

    await queryRunner.query(`
      CREATE TABLE "supplier_invoice_lines" (
        "id" uuid NOT NULL,
        "invoiceId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "barcode" character varying(64) NOT NULL,
        "name" character varying(120) NOT NULL,
        "unitOfMeasure" character varying(16) NOT NULL,
        "quantity" integer NOT NULL,
        "unitCost" numeric(12, 2) NOT NULL,
        "lineCost" numeric(12, 2) NOT NULL,
        CONSTRAINT "pk_supplier_invoice_lines_id" PRIMARY KEY ("id"),
        CONSTRAINT "fk_supplier_invoice_lines_invoice_id"
          FOREIGN KEY ("invoiceId") REFERENCES "supplier_invoices"("id")
          ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_supplier_invoice_lines_invoice_id"
      ON "supplier_invoice_lines" ("invoiceId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_supplier_invoice_lines_invoice_id"`);
    await queryRunner.query(`DROP TABLE "supplier_invoice_lines"`);
    await queryRunner.query(`DROP INDEX "public"."uq_supplier_invoices_tenant_reference"`);
    await queryRunner.query(`DROP TABLE "supplier_invoices"`);
    await queryRunner.query(`
      ALTER TABLE "inventory_items"
      DROP COLUMN "averageUnitCost"
    `);
  }
}
