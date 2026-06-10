import type { DataSource, EntityManager } from 'typeorm';

import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import { ProcessedEventTypeormEntity } from '../entities/processed-event.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormProcessedEventRepository implements ProcessedEventRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findByEventId(eventId: string): Promise<ProcessedEvent | null> {
    const entity = await this.repositoryAccessor.getRepository(ProcessedEventTypeormEntity).findOne({
      where: {
        eventId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async findByAggregateIdAndEventName(
    tenantId: string,
    aggregateId: string,
    eventName: string
  ): Promise<ProcessedEvent | null> {
    const entity = await this.repositoryAccessor.getRepository(ProcessedEventTypeormEntity).findOne({
      where: {
        tenantId,
        aggregateId,
        eventName
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(event: ProcessedEvent): Promise<void> {
    const eventState = event.toPrimitives();

    await this.repositoryAccessor.getRepository(ProcessedEventTypeormEntity).save({
      eventId: eventState.eventId,
      eventName: eventState.eventName,
      aggregateId: eventState.aggregateId,
      tenantId: eventState.tenantId,
      processedAt: new Date(eventState.processedAt),
      createdAt: new Date(eventState.createdAt)
    });
  }
}

function toDomain(entity: ProcessedEventTypeormEntity): ProcessedEvent {
  return ProcessedEvent.rehydrate({
    eventId: entity.eventId,
    eventName: entity.eventName,
    aggregateId: entity.aggregateId,
    tenantId: entity.tenantId,
    processedAt: entity.processedAt,
    createdAt: entity.createdAt
  });
}
