import type { EventEnvelope, SaleCompletedEventPayload } from '@supermarket/shared-domain';
import { createSaleCompletedEvent, SalePaymentMethod } from '@supermarket/shared-domain';

import type {
  InventoryTransactionContext,
  InventoryTransactionRunnerPort
} from '#/application/ports/inventory-transaction-runner.port';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';
import type { InventoryItemRepositoryPort } from '#/domain/repositories/inventory-item.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { StockMovementRepositoryPort } from '#/domain/repositories/stock-movement.repository';

export class InMemoryInventoryItemRepository implements InventoryItemRepositoryPort {
  private readonly items = new Map<string, InventoryItem>();

  async findByProductId(tenantId: string, productId: string): Promise<InventoryItem | null> {
    return this.items.get(buildKey(tenantId, productId)) ?? null;
  }

  async save(item: InventoryItem): Promise<void> {
    const itemState = item.toPrimitives();

    this.items.set(buildKey(itemState.tenantId, itemState.productId), item);
  }

  all(): InventoryItem[] {
    return [...this.items.values()];
  }
}

export class InMemoryStockMovementRepository implements StockMovementRepositoryPort {
  private readonly items = new Map<string, StockMovement>();

  async save(movement: StockMovement): Promise<void> {
    const movementState = movement.toPrimitives();

    this.items.set(movementState.id, movement);
  }

  all(): StockMovement[] {
    return [...this.items.values()];
  }
}

export class InMemoryProcessedEventRepository implements ProcessedEventRepositoryPort {
  private readonly items = new Map<string, ProcessedEvent>();

  async findByEventId(eventId: string): Promise<ProcessedEvent | null> {
    return this.items.get(eventId) ?? null;
  }

  async save(event: ProcessedEvent): Promise<void> {
    const eventState = event.toPrimitives();

    this.items.set(eventState.eventId, event);
  }

  all(): ProcessedEvent[] {
    return [...this.items.values()];
  }
}

interface InMemoryInventoryTransactionRunnerOptions {
  inventoryItemRepository?: InMemoryInventoryItemRepository;
  processedEventRepository?: InMemoryProcessedEventRepository;
  stockMovementRepository?: InMemoryStockMovementRepository;
}

export class InMemoryInventoryTransactionRunner implements InventoryTransactionRunnerPort {
  readonly context: InventoryTransactionContext;

  constructor(options: InMemoryInventoryTransactionRunnerOptions = {}) {
    this.context = {
      inventoryItemRepository: options.inventoryItemRepository ?? new InMemoryInventoryItemRepository(),
      processedEventRepository:
        options.processedEventRepository ?? new InMemoryProcessedEventRepository(),
      stockMovementRepository:
        options.stockMovementRepository ?? new InMemoryStockMovementRepository()
    };
  }

  async execute<T>(work: (context: InventoryTransactionContext) => Promise<T>): Promise<T> {
    return work(this.context);
  }
}

export function createSaleCompletedEventFixture(
  overrides: Partial<SaleCompletedEventPayload> = {}
): EventEnvelope<SaleCompletedEventPayload> {
  return createSaleCompletedEvent({
    saleId: 'a34e2d05-c42a-48ea-b982-e0132aa86012',
    tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
    sessionId: 'e4acdad2-6ffd-4887-b41a-a8ac4b486702',
    registerId: 'register-01',
    operatorId: 'ff7c931f-a446-4d2e-9370-b8aa8911c598',
    paymentMethod: SalePaymentMethod.Cash,
    paidAmount: 29.7,
    changeAmount: 0.3,
    totalItemsQuantity: 3,
    subtotal: 29.4,
    total: 29.4,
    completedAt: '2026-06-09T21:00:00.000Z',
    items: [
      {
        productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
        barcode: '7891000000200',
        name: 'Orange Juice',
        unitOfMeasure: 'UNIT',
        unitPrice: 9.8,
        quantity: 3,
        lineTotal: 29.4
      }
    ],
    ...overrides
  });
}

function buildKey(tenantId: string, resourceId: string): string {
  return `${tenantId}:${resourceId}`;
}
