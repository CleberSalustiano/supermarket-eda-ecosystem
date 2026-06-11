import type {
  EventEnvelope,
  EventPayload,
  InventoryLossRegisteredEventPayload,
  SaleCanceledEventPayload,
  SaleCompletedEventPayload
} from '@supermarket/shared-domain';
import {
  createInventoryLossRegisteredEvent,
  createSaleCanceledEvent,
  createSaleCompletedEvent,
  InventoryLossReason,
  SalePaymentMethod
} from '@supermarket/shared-domain';

import type { IntegrationEventPublicationStatus } from '#/application/dto/integration-event-publication-status';
import type { InventoryEventPublisherPort } from '#/application/ports/inventory-event-publisher.port';
import type {
  InventoryTransactionContext,
  InventoryTransactionRunnerPort
} from '#/application/ports/inventory-transaction-runner.port';
import type { OutboxEventRelayPort } from '#/application/ports/outbox-event-relay.port';
import type {
  OutboxEventRepositoryPort,
  StoredOutboxEvent
} from '#/application/ports/outbox-event-repository.port';
import { InventoryLoss } from '#/domain/entities/inventory-loss.entity';
import { InventoryItem } from '#/domain/entities/inventory-item.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { StockMovement } from '#/domain/entities/stock-movement.entity';
import type { InventoryLossRepositoryPort } from '#/domain/repositories/inventory-loss.repository';
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

export class InMemoryInventoryLossRepository implements InventoryLossRepositoryPort {
  private readonly items = new Map<string, InventoryLoss>();

  async save(loss: InventoryLoss): Promise<void> {
    const lossState = loss.toPrimitives();

    this.items.set(lossState.id, loss);
  }

  all(): InventoryLoss[] {
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

export class InMemoryOutboxEventRepository implements OutboxEventRepositoryPort {
  private readonly items = new Map<string, StoredOutboxEvent>();

  async save<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    this.items.set(event.eventId, {
      ...event,
      attempts: 0,
      failureReason: null,
      publishedAt: null
    });
  }

  async findById(eventId: string): Promise<StoredOutboxEvent | null> {
    return this.items.get(eventId) ?? null;
  }

  async markPublished(eventId: string, publishedAt: Date): Promise<void> {
    const event = this.items.get(eventId);

    if (!event) {
      return;
    }

    this.items.set(eventId, {
      ...event,
      failureReason: null,
      publishedAt: publishedAt.toISOString()
    });
  }

  async registerFailure(eventId: string, failureReason: string): Promise<void> {
    const event = this.items.get(eventId);

    if (!event) {
      return;
    }

    this.items.set(eventId, {
      ...event,
      attempts: event.attempts + 1,
      failureReason,
      publishedAt: null
    });
  }

  all(): StoredOutboxEvent[] {
    return [...this.items.values()];
  }
}

export class InMemoryProcessedEventRepository implements ProcessedEventRepositoryPort {
  private readonly items = new Map<string, ProcessedEvent>();

  async findByEventId(eventId: string): Promise<ProcessedEvent | null> {
    return this.items.get(eventId) ?? null;
  }

  async findByAggregateIdAndEventName(
    tenantId: string,
    aggregateId: string,
    eventName: string
  ): Promise<ProcessedEvent | null> {
    for (const event of this.items.values()) {
      const eventState = event.toPrimitives();

      if (
        eventState.tenantId === tenantId &&
        eventState.aggregateId === aggregateId &&
        eventState.eventName === eventName
      ) {
        return event;
      }
    }

    return null;
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
  inventoryLossRepository?: InMemoryInventoryLossRepository;
  inventoryItemRepository?: InMemoryInventoryItemRepository;
  outboxEventRepository?: InMemoryOutboxEventRepository;
  processedEventRepository?: InMemoryProcessedEventRepository;
  stockMovementRepository?: InMemoryStockMovementRepository;
}

export class InMemoryInventoryTransactionRunner implements InventoryTransactionRunnerPort {
  readonly context: InventoryTransactionContext;

  constructor(options: InMemoryInventoryTransactionRunnerOptions = {}) {
    this.context = {
      inventoryLossRepository:
        options.inventoryLossRepository ?? new InMemoryInventoryLossRepository(),
      inventoryItemRepository: options.inventoryItemRepository ?? new InMemoryInventoryItemRepository(),
      outboxEventRepository: options.outboxEventRepository ?? new InMemoryOutboxEventRepository(),
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

export function createSaleCanceledEventFixture(
  overrides: Partial<SaleCanceledEventPayload> = {}
): EventEnvelope<SaleCanceledEventPayload> {
  return createSaleCanceledEvent({
    saleId: 'a34e2d05-c42a-48ea-b982-e0132aa86012',
    tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
    sessionId: 'e4acdad2-6ffd-4887-b41a-a8ac4b486702',
    registerId: 'register-01',
    operatorId: 'ff7c931f-a446-4d2e-9370-b8aa8911c598',
    previousStatus: 'COMPLETED',
    paymentMethod: SalePaymentMethod.Cash,
    paidAmount: 29.7,
    changeAmount: 0.3,
    totalItemsQuantity: 3,
    subtotal: 29.4,
    total: 29.4,
    cancellationReason: 'Customer requested cancellation',
    canceledAt: '2026-06-09T21:05:00.000Z',
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

export function createInventoryLossRegisteredEventFixture(
  overrides: Partial<InventoryLossRegisteredEventPayload> = {}
): EventEnvelope<InventoryLossRegisteredEventPayload> {
  return createInventoryLossRegisteredEvent({
    lossId: '08bb36fd-7bbc-41cc-a0cc-03836834d591',
    stockMovementId: '8c0e9188-93b5-44e3-bf99-d6ba510ae8df',
    tenantId: '0ace7a51-b8bf-4050-86db-006b0d0f5af7',
    productId: '9580902a-ded1-4e9f-9b45-ab7cb8d8340d',
    barcode: '7891000000200',
    name: 'Orange Juice',
    unitOfMeasure: 'UNIT',
    quantity: 2,
    reasonCode: InventoryLossReason.Damaged,
    notes: 'Bottle leaked',
    onHandQuantityAfterLoss: -2,
    recordedAt: '2026-06-11T10:00:00.000Z',
    ...overrides
  });
}

export class FakeOutboxEventRelay implements OutboxEventRelayPort {
  readonly dispatchedEventIds: string[] = [];

  constructor(private readonly status: IntegrationEventPublicationStatus = 'published') {}

  async dispatch(eventId: string): Promise<IntegrationEventPublicationStatus> {
    this.dispatchedEventIds.push(eventId);

    return this.status;
  }
}

export class FakeInventoryEventPublisher implements InventoryEventPublisherPort {
  readonly publishedEvents: EventEnvelope[] = [];
  constructor(private readonly shouldFail: boolean = false) {}

  async publish<TPayload extends EventPayload>(event: EventEnvelope<TPayload>): Promise<void> {
    if (this.shouldFail) {
      throw new Error('Simulated publisher failure');
    }

    this.publishedEvents.push(event);
  }
}

function buildKey(tenantId: string, resourceId: string): string {
  return `${tenantId}:${resourceId}`;
}
