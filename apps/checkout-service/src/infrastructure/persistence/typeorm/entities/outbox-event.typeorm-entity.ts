import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('outbox_events')
export class OutboxEventTypeormEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('varchar', { length: 128 })
  eventName!: string;

  @Column('varchar', { length: 160 })
  topic!: string;

  @Column('uuid')
  aggregateId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('timestamptz')
  occurredAt!: Date;

  @Column('jsonb')
  payload!: Record<string, unknown>;

  @Column('integer', { default: 0 })
  attempts!: number;

  @Column('text', { nullable: true })
  failureReason!: string | null;

  @Column('timestamptz', { nullable: true })
  publishedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date;
}
