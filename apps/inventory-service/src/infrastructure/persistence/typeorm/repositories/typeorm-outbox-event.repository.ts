import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { EntityManager } from 'typeorm';

import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

import type {
  OutboxEventRepositoryPort,
  StoredOutboxEvent
} from '#/application/ports/outbox-event-repository.port';
import { OutboxEventTypeormEntity } from '../entities/outbox-event.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

@Injectable()
export class TypeormOutboxEventRepository implements OutboxEventRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(
    @Inject(DataSource) repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager
  ) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async save<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    await this.repositoryAccessor.getRepository(OutboxEventTypeormEntity).save({
      id: event.eventId,
      eventName: event.eventName,
      topic: event.topic,
      aggregateId: event.aggregateId,
      tenantId: event.tenantId,
      occurredAt: new Date(event.occurredAt),
      payload: event.payload as unknown as Record<string, unknown>,
      attempts: 0,
      failureReason: null,
      publishedAt: null
    });
  }

  async findById(eventId: string): Promise<StoredOutboxEvent | null> {
    const entity = await this.repositoryAccessor.getRepository(OutboxEventTypeormEntity).findOne({
      where: {
        id: eventId
      }
    });

    if (!entity) {
      return null;
    }

    return {
      eventId: entity.id,
      eventName: entity.eventName,
      topic: entity.topic,
      aggregateId: entity.aggregateId,
      tenantId: entity.tenantId,
      occurredAt: entity.occurredAt.toISOString(),
      payload: entity.payload as unknown as StoredOutboxEvent['payload'],
      attempts: entity.attempts,
      failureReason: entity.failureReason,
      publishedAt: entity.publishedAt?.toISOString() ?? null
    };
  }

  async markPublished(eventId: string, publishedAt: Date): Promise<void> {
    await this.repositoryAccessor.getRepository(OutboxEventTypeormEntity).update(
      {
        id: eventId
      },
      {
        publishedAt,
        failureReason: null
      }
    );
  }

  async registerFailure(eventId: string, failureReason: string): Promise<void> {
    await this.repositoryAccessor
      .getRepository(OutboxEventTypeormEntity)
      .createQueryBuilder()
      .update(OutboxEventTypeormEntity)
      .set({
        attempts: () => 'attempts + 1',
        failureReason,
        publishedAt: null
      })
      .where('id = :eventId', { eventId })
      .execute();
  }
}
