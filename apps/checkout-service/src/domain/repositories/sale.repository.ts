import type { Sale } from '../entities/sale.entity';

export const SALE_REPOSITORY = Symbol('SALE_REPOSITORY');

export interface SaleRepositoryPort {
  findById(tenantId: string, saleId: string): Promise<Sale | null>;
  /**
   * Loads the sale under an exclusive row lock held until the surrounding
   * transaction ends, so concurrent mutations of the same sale serialize and
   * the later one re-checks the committed state. Must run inside a transaction.
   */
  findByIdForUpdate(tenantId: string, saleId: string): Promise<Sale | null>;
  hasNonTerminalBySessionId(tenantId: string, sessionId: string): Promise<boolean>;
  save(sale: Sale): Promise<void>;
}
