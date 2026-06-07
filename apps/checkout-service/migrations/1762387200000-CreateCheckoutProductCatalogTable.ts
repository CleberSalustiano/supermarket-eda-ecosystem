import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckoutProductCatalogTable1762387200000 implements MigrationInterface {
  name = 'CreateCheckoutProductCatalogTable1762387200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "product_catalog_items" (
        "productId" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "barcode" varchar(64) NOT NULL,
        "name" varchar(120) NOT NULL,
        "unitOfMeasure" varchar(16) NOT NULL,
        "unitPrice" numeric(12,2) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "priceUpdatedAt" timestamptz NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pk_product_catalog_items_product_id" PRIMARY KEY ("productId")
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_product_catalog_items_tenant_barcode"
      ON "product_catalog_items" ("tenantId", "barcode")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_product_catalog_items_tenant_barcode"');
    await queryRunner.query('DROP TABLE "product_catalog_items"');
  }
}
