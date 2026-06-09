import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCheckoutSaleCompletionAndOutbox1762905600000 implements MigrationInterface {
  name = 'AddCheckoutSaleCompletionAndOutbox1762905600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "sales"
      ADD COLUMN "paymentMethod" character varying(32),
      ADD COLUMN "paidAmount" numeric(12,2),
      ADD COLUMN "changeAmount" numeric(12,2),
      ADD COLUMN "paidAt" TIMESTAMPTZ,
      ADD COLUMN "completedAt" TIMESTAMPTZ
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
        CONSTRAINT "pk_checkout_outbox_events_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_checkout_outbox_events_published_at"
      ON "outbox_events" ("publishedAt")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."idx_checkout_outbox_events_published_at"`);
    await queryRunner.query(`DROP TABLE "outbox_events"`);
    await queryRunner.query(`
      ALTER TABLE "sales"
      DROP COLUMN "completedAt",
      DROP COLUMN "paidAt",
      DROP COLUMN "changeAmount",
      DROP COLUMN "paidAmount",
      DROP COLUMN "paymentMethod"
    `);
  }
}
