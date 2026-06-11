import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddProcessedEventsAggregateLookupIndex1763683200000
  implements MigrationInterface
{
  name = 'AddProcessedEventsAggregateLookupIndex1763683200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_processed_events_tenant_aggregate_name"
      ON "processed_events" ("tenantId", "aggregateId", "eventName")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX "public"."idx_processed_events_tenant_aggregate_name"`
    );
  }
}
