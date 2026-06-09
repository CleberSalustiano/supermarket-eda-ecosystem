import type { OutboxEventRepositoryPort } from './outbox-event-repository.port';
import type { PosSessionRepositoryPort } from '#/domain/repositories/pos-session.repository';
import type { ProductCatalogItemRepositoryPort } from '#/domain/repositories/product-catalog-item.repository';
import type { SaleRepositoryPort } from '#/domain/repositories/sale.repository';

export interface CheckoutTransactionContext {
  outboxEventRepository: OutboxEventRepositoryPort;
  productCatalogItemRepository: ProductCatalogItemRepositoryPort;
  posSessionRepository: PosSessionRepositoryPort;
  saleRepository: SaleRepositoryPort;
}

export interface CheckoutTransactionRunnerPort {
  execute<T>(work: (context: CheckoutTransactionContext) => Promise<T>): Promise<T>;
}

export const CHECKOUT_TRANSACTION_RUNNER = Symbol('CHECKOUT_TRANSACTION_RUNNER');
