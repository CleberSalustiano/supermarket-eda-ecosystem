import type { ApprovalThrottleScope } from '#/domain/entities/approval-throttle.entity';
import { ApprovalThrottle } from '#/domain/entities/approval-throttle.entity';
import type { ApprovalThrottleRepositoryPort } from '#/domain/repositories/approval-throttle.repository';
import { ApprovalThrottleTypeormEntity } from '../entities/approval-throttle.typeorm-entity';
import {
  asTypeormRepositoryAccessor,
  type TypeormRepositoryAccessor
} from './typeorm-repository-accessor';

/**
 * Must run on a transactional EntityManager: `findForUpdate` takes a
 * `SELECT ... FOR UPDATE` row lock that lasts until the transaction ends.
 */
export class TypeormApprovalThrottleRepository implements ApprovalThrottleRepositoryPort {
  private readonly repositoryAccessor: TypeormRepositoryAccessor;

  constructor(repositoryAccessor: TypeormRepositoryAccessor) {
    this.repositoryAccessor = asTypeormRepositoryAccessor(repositoryAccessor);
  }

  async findForUpdate(
    tenantId: string,
    scope: ApprovalThrottleScope,
    subject: string
  ): Promise<ApprovalThrottle> {
    // Validates the key before touching the database.
    ApprovalThrottle.open({ tenantId, scope, subject });

    const repository = this.repositoryAccessor.getRepository(ApprovalThrottleTypeormEntity);

    // INSERT ... ON CONFLICT DO NOTHING: a concurrent inserter blocks here until
    // the first one commits, then the locking read below sees the committed row.
    await repository
      .createQueryBuilder()
      .insert()
      .into(ApprovalThrottleTypeormEntity)
      .values({
        tenantId,
        scope,
        subject,
        failureCount: 0,
        windowStartedAt: null,
        lockedUntil: null
      })
      .orIgnore()
      .updateEntity(false)
      .execute();

    const entity = await repository.findOne({
      where: { tenantId, scope, subject },
      lock: { mode: 'pessimistic_write' }
    });

    if (!entity) {
      throw new Error('Approval throttle row could not be loaded');
    }

    return ApprovalThrottle.rehydrate({
      tenantId: entity.tenantId,
      scope: entity.scope,
      subject: entity.subject,
      failureCount: entity.failureCount,
      windowStartedAt: entity.windowStartedAt,
      lockedUntil: entity.lockedUntil
    });
  }

  async save(throttle: ApprovalThrottle): Promise<void> {
    const state = throttle.toPrimitives();

    await this.repositoryAccessor.getRepository(ApprovalThrottleTypeormEntity).update(
      { tenantId: state.tenantId, scope: state.scope, subject: state.subject },
      {
        failureCount: state.failureCount,
        windowStartedAt: state.windowStartedAt === null ? null : new Date(state.windowStartedAt),
        lockedUntil: state.lockedUntil === null ? null : new Date(state.lockedUntil)
      }
    );
  }

  async clear(tenantId: string, scope: ApprovalThrottleScope, subject: string): Promise<void> {
    await this.repositoryAccessor
      .getRepository(ApprovalThrottleTypeormEntity)
      .update(
        { tenantId, scope, subject },
        { failureCount: 0, windowStartedAt: null, lockedUntil: null }
      );
  }
}
