import type { Sale } from '../entities/sale.entity';

export const SALE_REPOSITORY = Symbol('SALE_REPOSITORY');

export interface SaleRepositoryPort {
  findById(tenantId: string, saleId: string): Promise<Sale | null>;
  hasNonTerminalBySessionId(tenantId: string, sessionId: string): Promise<boolean>;
  save(sale: Sale): Promise<void>;
}
