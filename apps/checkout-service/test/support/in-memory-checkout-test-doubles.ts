import type {
  CheckoutTransactionContext,
  CheckoutTransactionRunnerPort
} from '#/application/ports/checkout-transaction-runner.port';
import { PosSession } from '#/domain/entities/pos-session.entity';
import { ProductCatalogItem } from '#/domain/entities/product-catalog-item.entity';
import { Sale } from '#/domain/entities/sale.entity';
import type { PosSessionRepositoryPort } from '#/domain/repositories/pos-session.repository';
import type { ProductCatalogItemRepositoryPort } from '#/domain/repositories/product-catalog-item.repository';
import type { SaleRepositoryPort } from '#/domain/repositories/sale.repository';

export class InMemoryProductCatalogItemRepository implements ProductCatalogItemRepositoryPort {
  private readonly items = new Map<string, ProductCatalogItem>();

  async findByProductId(
    tenantId: string,
    productId: string
  ): Promise<ProductCatalogItem | null> {
    return this.items.get(buildKey(tenantId, productId)) ?? null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<ProductCatalogItem | null> {
    return (
      [...this.items.values()].find((item) => {
        const itemState = item.toPrimitives();

        return itemState.tenantId === tenantId && itemState.barcode === barcode.trim();
      }) ?? null
    );
  }

  async save(item: ProductCatalogItem): Promise<void> {
    const itemState = item.toPrimitives();

    this.items.set(buildKey(itemState.tenantId, itemState.productId), item);
  }

  all(): ProductCatalogItem[] {
    return [...this.items.values()];
  }
}

export class InMemoryPosSessionRepository implements PosSessionRepositoryPort {
  private readonly sessions = new Map<string, PosSession>();

  async findById(tenantId: string, sessionId: string): Promise<PosSession | null> {
    return this.sessions.get(buildKey(tenantId, sessionId)) ?? null;
  }

  async findOpenByRegisterId(tenantId: string, registerId: string): Promise<PosSession | null> {
    return (
      [...this.sessions.values()].find((session) => {
        const sessionState = session.toPrimitives();

        return (
          sessionState.tenantId === tenantId &&
          sessionState.registerId === registerId.trim() &&
          sessionState.status === 'OPEN'
        );
      }) ?? null
    );
  }

  async save(session: PosSession): Promise<void> {
    const sessionState = session.toPrimitives();

    this.sessions.set(buildKey(sessionState.tenantId, sessionState.id), session);
  }

  all(): PosSession[] {
    return [...this.sessions.values()];
  }
}

export class InMemorySaleRepository implements SaleRepositoryPort {
  private readonly sales = new Map<string, Sale>();

  async findById(tenantId: string, saleId: string): Promise<Sale | null> {
    return this.sales.get(buildKey(tenantId, saleId)) ?? null;
  }

  async save(sale: Sale): Promise<void> {
    const saleState = sale.toPrimitives();

    this.sales.set(buildKey(saleState.tenantId, saleState.id), sale);
  }

  all(): Sale[] {
    return [...this.sales.values()];
  }
}

interface InMemoryCheckoutTransactionRunnerOptions {
  productCatalogItemRepository?: InMemoryProductCatalogItemRepository;
  posSessionRepository?: InMemoryPosSessionRepository;
  saleRepository?: InMemorySaleRepository;
}

export class InMemoryCheckoutTransactionRunner implements CheckoutTransactionRunnerPort {
  readonly context: CheckoutTransactionContext;

  constructor(options: InMemoryCheckoutTransactionRunnerOptions = {}) {
    this.context = {
      productCatalogItemRepository:
        options.productCatalogItemRepository ?? new InMemoryProductCatalogItemRepository(),
      posSessionRepository: options.posSessionRepository ?? new InMemoryPosSessionRepository(),
      saleRepository: options.saleRepository ?? new InMemorySaleRepository()
    };
  }

  async execute<T>(work: (context: CheckoutTransactionContext) => Promise<T>): Promise<T> {
    return work(this.context);
  }
}

function buildKey(tenantId: string, productId: string): string {
  return `${tenantId}:${productId}`;
}
