import type { DataSource, EntityManager } from 'typeorm';

import type { PosSessionRepositoryPort } from '#/domain/repositories/pos-session.repository';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { PosSessionTypeormEntity } from '../entities/pos-session.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

export class TypeormPosSessionRepository implements PosSessionRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor | DataSource | EntityManager) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findById(tenantId: string, sessionId: string): Promise<PosSession | null> {
    const entity = await this.repositoryAccessor.getRepository(PosSessionTypeormEntity).findOne({
      where: {
        id: sessionId,
        tenantId
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async findOpenByRegisterId(tenantId: string, registerId: string): Promise<PosSession | null> {
    const entity = await this.repositoryAccessor.getRepository(PosSessionTypeormEntity).findOne({
      where: {
        tenantId,
        registerId,
        status: 'OPEN'
      }
    });

    return entity ? toDomain(entity) : null;
  }

  async save(session: PosSession): Promise<void> {
    const sessionState = session.toPrimitives();

    await this.repositoryAccessor.getRepository(PosSessionTypeormEntity).save({
      id: sessionState.id,
      tenantId: sessionState.tenantId,
      registerId: sessionState.registerId,
      operatorId: sessionState.operatorId,
      openingFloatAmount: sessionState.openingFloatAmount,
      declaredCashAmount: sessionState.declaredCashAmount,
      status: sessionState.status,
      openedAt: new Date(sessionState.openedAt),
      closedAt: sessionState.closedAt ? new Date(sessionState.closedAt) : null,
      createdAt: new Date(sessionState.createdAt),
      updatedAt: new Date(sessionState.updatedAt)
    });
  }
}

function toDomain(entity: PosSessionTypeormEntity): PosSession {
  return PosSession.rehydrate({
    id: entity.id,
    tenantId: entity.tenantId,
    registerId: entity.registerId,
    operatorId: entity.operatorId,
    openingFloatAmount: entity.openingFloatAmount,
    declaredCashAmount: entity.declaredCashAmount,
    status: entity.status as 'OPEN' | 'CLOSED',
    openedAt: entity.openedAt,
    closedAt: entity.closedAt,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt
  });
}
