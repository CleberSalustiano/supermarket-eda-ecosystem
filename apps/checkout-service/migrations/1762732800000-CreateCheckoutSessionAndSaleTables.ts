import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCheckoutSessionAndSaleTables1762732800000 implements MigrationInterface {
  name = 'CreateCheckoutSessionAndSaleTables1762732800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "pos_sessions" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "registerId" character varying(64) NOT NULL,
        "operatorId" uuid NOT NULL,
        "openingFloatAmount" numeric(12,2) NOT NULL,
        "status" character varying(16) NOT NULL,
        "openedAt" TIMESTAMPTZ NOT NULL,
        "closedAt" TIMESTAMPTZ,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_pos_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_pos_sessions_tenant_register"
      ON "pos_sessions" ("tenantId", "registerId")
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_pos_sessions_open_register"
      ON "pos_sessions" ("tenantId", "registerId")
      WHERE "status" = 'OPEN'
    `);
    await queryRunner.query(`
      CREATE TABLE "sales" (
        "id" uuid NOT NULL,
        "tenantId" uuid NOT NULL,
        "sessionId" uuid NOT NULL,
        "status" character varying(16) NOT NULL,
        "totalItemsQuantity" integer NOT NULL,
        "subtotal" numeric(12,2) NOT NULL,
        "total" numeric(12,2) NOT NULL,
        "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_sales_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_sales_session_id" FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_sales_tenant_session"
      ON "sales" ("tenantId", "sessionId")
    `);
    await queryRunner.query(`
      CREATE TABLE "sale_items" (
        "saleId" uuid NOT NULL,
        "productId" uuid NOT NULL,
        "barcode" character varying(64) NOT NULL,
        "name" character varying(120) NOT NULL,
        "unitOfMeasure" character varying(16) NOT NULL,
        "unitPrice" numeric(12,2) NOT NULL,
        "quantity" integer NOT NULL,
        "lineTotal" numeric(12,2) NOT NULL,
        CONSTRAINT "PK_sale_items_sale_product" PRIMARY KEY ("saleId", "productId"),
        CONSTRAINT "FK_sale_items_sale_id" FOREIGN KEY ("saleId") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE NO ACTION
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_sale_items_sale"
      ON "sale_items" ("saleId")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_sale_items_sale"`);
    await queryRunner.query(`DROP TABLE "sale_items"`);
    await queryRunner.query(`DROP INDEX "public"."idx_sales_tenant_session"`);
    await queryRunner.query(`DROP TABLE "sales"`);
    await queryRunner.query(`DROP INDEX "public"."uq_pos_sessions_open_register"`);
    await queryRunner.query(`DROP INDEX "public"."idx_pos_sessions_tenant_register"`);
    await queryRunner.query(`DROP TABLE "pos_sessions"`);
  }
}
