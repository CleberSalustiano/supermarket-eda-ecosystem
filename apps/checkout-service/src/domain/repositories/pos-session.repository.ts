import type { PosSession } from '../entities/pos-session.entity';

export const POS_SESSION_REPOSITORY = Symbol('POS_SESSION_REPOSITORY');

export interface PosSessionRepositoryPort {
  findById(tenantId: string, sessionId: string): Promise<PosSession | null>;
  findOpenByRegisterId(tenantId: string, registerId: string): Promise<PosSession | null>;
  save(session: PosSession): Promise<void>;
}
