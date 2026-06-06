import type { EntityManager, EntityTarget, ObjectLiteral, Repository } from 'typeorm';

export interface TypeormRepositoryAccessor {
  getRepository<Entity extends ObjectLiteral>(target: EntityTarget<Entity>): Repository<Entity>;
}

export function asTypeormRepositoryAccessor(
  accessor: TypeormRepositoryAccessor | EntityManager
): TypeormRepositoryAccessor {
  return accessor;
}
