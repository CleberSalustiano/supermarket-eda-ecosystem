import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

@Entity('processed_events')
@Index('idx_processed_events_tenant_name', ['tenantId', 'eventName'])
export class ProcessedEventTypeormEntity {
  @PrimaryColumn('uuid')
  eventId!: string;

  @Column('varchar', { length: 128 })
  eventName!: string;

  @Column('uuid')
  aggregateId!: string;

  @Column('uuid')
  tenantId!: string;

  @Column('timestamptz')
  processedAt!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date;
}
