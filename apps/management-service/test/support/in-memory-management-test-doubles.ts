import type {
  EventEnvelope,
  EventPayload,
  InventoryLossRegisteredEventPayload,
  RegisterClosedEventPayload,
  SaleCanceledEventPayload,
  SaleCompletedEventPayload
} from '@supermarket/shared-domain';
import {
  InventoryLossReason,
  SalePaymentMethod
} from '@supermarket/shared-domain';

import { CashReconciliation } from '#/domain/entities/cash-reconciliation.entity';
import { DailyFinancialConsolidation } from '#/domain/entities/daily-financial-consolidation.entity';
import { Employee } from '#/domain/entities/employee.entity';
import { FinancialEntry } from '#/domain/entities/financial-entry.entity';
import { InventoryLossEntry } from '#/domain/entities/inventory-loss-entry.entity';
import { ProcessedEvent } from '#/domain/entities/processed-event.entity';
import { Product } from '#/domain/entities/product.entity';
import type { CredentialHasherPort } from '#/application/ports/credential-hasher.port';
import type {
  ManagementTransactionContext,
  ManagementTransactionRunnerPort
} from '#/application/ports/management-transaction-runner.port';
import type { OutboxEventRelayPort } from '#/application/ports/outbox-event-relay.port';
import type {
  OutboxEventRepositoryPort,
  StoredOutboxEvent
} from '#/application/ports/outbox-event-repository.port';
import type { DailyFinancialConsolidationRepositoryPort } from '#/domain/repositories/daily-financial-consolidation.repository';
import type { EmployeeRepositoryPort } from '#/domain/repositories/employee.repository';
import type { CashReconciliationRepositoryPort } from '#/domain/repositories/cash-reconciliation.repository';
import type { FinancialEntryRepositoryPort } from '#/domain/repositories/financial-entry.repository';
import type {
  FinancialEntryBusinessDateSummary,
} from '#/domain/repositories/financial-entry.repository';
import type {
  InventoryLossEntryBusinessDateSummary,
  InventoryLossEntryRepositoryPort
} from '#/domain/repositories/inventory-loss-entry.repository';
import type { ProcessedEventRepositoryPort } from '#/domain/repositories/processed-event.repository';
import type { ProductRepositoryPort } from '#/domain/repositories/product.repository';
import type { IntegrationEventPublicationStatus } from '#/application/dto/integration-event-publication-status';

export class InMemoryProductRepository implements ProductRepositoryPort {
  private readonly items = new Map<string, Product>();

  async findById(tenantId: string, productId: string): Promise<Product | null> {
    const product = this.items.get(buildKey(tenantId, productId));

    return product ?? null;
  }

  async findByBarcode(tenantId: string, barcode: string): Promise<Product | null> {
    return (
      [...this.items.values()].find((item) => {
        const productState = item.toPrimitives();

        return productState.tenantId === tenantId && productState.barcode === barcode;
      }) ?? null
    );
  }

  async save(product: Product): Promise<void> {
    const productState = product.toPrimitives();

    this.items.set(buildKey(productState.tenantId, productState.id), product);
  }

  all(): Product[] {
    return [...this.items.values()];
  }
}

export class InMemoryEmployeeRepository implements EmployeeRepositoryPort {
  private readonly items = new Map<string, Employee>();

  async findByEmployeeCode(tenantId: string, employeeCode: string): Promise<Employee | null> {
    return (
      [...this.items.values()].find((item) => {
        const employeeState = item.toPrimitives();

        return (
          employeeState.tenantId === tenantId &&
          employeeState.employeeCode === employeeCode.trim().toUpperCase()
        );
      }) ?? null
    );
  }

  async save(employee: Employee): Promise<void> {
    const employeeState = employee.toPrimitives();

    this.items.set(buildKey(employeeState.tenantId, employeeState.id), employee);
  }

  all(): Employee[] {
    return [...this.items.values()];
  }
}

export class InMemoryFinancialEntryRepository implements FinancialEntryRepositoryPort {
  private readonly items = new Map<string, FinancialEntry>();

  async saveIfAbsent(entry: FinancialEntry): Promise<boolean> {
    const entryState = entry.toPrimitives();

    if (this.items.has(entryState.sourceEventId)) {
      return false;
    }

    this.items.set(entryState.sourceEventId, entry);

    return true;
  }

  async findSaleRevenueBySaleId(tenantId: string, saleId: string): Promise<FinancialEntry | null> {
    for (const entry of this.items.values()) {
      const entryState = entry.toPrimitives();

      if (
        entryState.tenantId === tenantId &&
        entryState.saleId === saleId &&
        entryState.entryType === 'SALE_REVENUE'
      ) {
        return entry;
      }
    }

    return null;
  }

  async sumNetCashMovementBySession(tenantId: string, sessionId: string): Promise<number> {
    const netCash = [...this.items.values()].reduce((total, entry) => {
      const entryState = entry.toPrimitives();

      if (entryState.tenantId !== tenantId || entryState.sessionId !== sessionId) {
        return total;
      }

      return total + entry.contributesNetCash();
    }, 0);

    return Number.parseFloat(netCash.toFixed(2));
  }

  async summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<FinancialEntryBusinessDateSummary[]> {
    const summaries = new Map<
      string,
      {
        businessDate: string;
        revenueNetTotal: number;
        netSalesCount: number;
        soldItemsQuantity: number;
      }
    >();

    for (const entry of this.items.values()) {
      const entryState = entry.toPrimitives();

      if (
        entryState.tenantId !== tenantId ||
        entryState.businessDate < fromDate ||
        entryState.businessDate > toDate
      ) {
        continue;
      }

      const existingSummary = summaries.get(entryState.businessDate) ?? {
        businessDate: entryState.businessDate,
        revenueNetTotal: 0,
        netSalesCount: 0,
        soldItemsQuantity: 0
      };

      existingSummary.revenueNetTotal = Number.parseFloat(
        (existingSummary.revenueNetTotal + entry.contributesGrossSales()).toFixed(2)
      );
      existingSummary.netSalesCount += entry.contributesSalesCount();
      existingSummary.soldItemsQuantity += entry.contributesItemsQuantity();

      summaries.set(entryState.businessDate, existingSummary);
    }

    return [...summaries.values()].sort((left, right) =>
      left.businessDate.localeCompare(right.businessDate)
    );
  }

  all(): FinancialEntry[] {
    return [...this.items.values()];
  }
}

export class InMemoryInventoryLossEntryRepository
  implements InventoryLossEntryRepositoryPort
{
  private readonly items = new Map<string, InventoryLossEntry>();

  async saveIfAbsent(entry: InventoryLossEntry): Promise<boolean> {
    const entryState = entry.toPrimitives();

    if (this.items.has(entryState.sourceEventId)) {
      return false;
    }

    this.items.set(entryState.sourceEventId, entry);

    return true;
  }

  async summarizeByBusinessDateRange(
    tenantId: string,
    fromDate: string,
    toDate: string
  ): Promise<InventoryLossEntryBusinessDateSummary[]> {
    const summaries = new Map<string, InventoryLossEntryBusinessDateSummary>();

    for (const entry of this.items.values()) {
      const entryState = entry.toPrimitives();

      if (
        entryState.tenantId !== tenantId ||
        entryState.businessDate < fromDate ||
        entryState.businessDate > toDate
      ) {
        continue;
      }

      const existingSummary = summaries.get(entryState.businessDate) ?? {
        businessDate: entryState.businessDate,
        lossAmountTotal: 0,
        lossItemsQuantity: 0,
        lossEventsCount: 0
      };

      existingSummary.lossAmountTotal = Number.parseFloat(
        (existingSummary.lossAmountTotal + entry.totalAmount()).toFixed(2)
      );
      existingSummary.lossItemsQuantity += entry.quantityValue();
      existingSummary.lossEventsCount += 1;

      summaries.set(entryState.businessDate, existingSummary);
    }

    return [...summaries.values()].sort((left, right) =>
      left.businessDate.localeCompare(right.businessDate)
    );
  }

  all(): InventoryLossEntry[] {
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

export class InMemoryCashReconciliationRepository
  implements CashReconciliationRepositoryPort
{
  private readonly items = new Map<string, CashReconciliation>();

  async saveIfAbsent(reconciliation: CashReconciliation): Promise<boolean> {
    const reconciliationState = reconciliation.toPrimitives();

    if (
      this.items.has(reconciliationState.sourceEventId) ||
      [...this.items.values()].some((item) => {
        const itemState = item.toPrimitives();

        return (
          itemState.tenantId === reconciliationState.tenantId &&
          itemState.sessionId === reconciliationState.sessionId
        );
      })
    ) {
      return false;
    }

    this.items.set(reconciliationState.sourceEventId, reconciliation);

    return true;
  }

  all(): CashReconciliation[] {
    return [...this.items.values()];
  }
}

export class InMemoryDailyFinancialConsolidationRepository
  implements DailyFinancialConsolidationRepositoryPort
{
  private readonly items = new Map<string, DailyFinancialConsolidation>();

  async accumulate(consolidation: DailyFinancialConsolidation): Promise<void> {
    const consolidationState = consolidation.toPrimitives();
    const key = buildKey(consolidationState.tenantId, consolidationState.businessDate);
    const existing = this.items.get(key);

    if (!existing) {
      this.items.set(
        key,
        DailyFinancialConsolidation.rehydrate({
          tenantId: consolidationState.tenantId,
          businessDate: consolidationState.businessDate,
          grossSalesTotal: consolidationState.grossSalesTotal,
          salesCount: consolidationState.salesCount,
          soldItemsQuantity: consolidationState.soldItemsQuantity,
          lastConsolidatedAt: new Date(consolidationState.lastConsolidatedAt),
          createdAt: new Date(consolidationState.createdAt),
          updatedAt: new Date(consolidationState.updatedAt)
        })
      );

      return;
    }

    const existingState = existing.toPrimitives();

    this.items.set(
      key,
      DailyFinancialConsolidation.rehydrate({
        tenantId: existingState.tenantId,
        businessDate: existingState.businessDate,
        grossSalesTotal: Number.parseFloat(
          (existingState.grossSalesTotal + consolidationState.grossSalesTotal).toFixed(2)
        ),
        salesCount: existingState.salesCount + consolidationState.salesCount,
        soldItemsQuantity:
          existingState.soldItemsQuantity + consolidationState.soldItemsQuantity,
        lastConsolidatedAt: new Date(
          existingState.lastConsolidatedAt >= consolidationState.lastConsolidatedAt
            ? existingState.lastConsolidatedAt
            : consolidationState.lastConsolidatedAt
        ),
        createdAt: new Date(existingState.createdAt),
        updatedAt: new Date(consolidationState.updatedAt)
      })
    );
  }

  all(): DailyFinancialConsolidation[] {
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

export class InMemoryManagementTransactionRunner implements ManagementTransactionRunnerPort {
  readonly cashReconciliationRepository = new InMemoryCashReconciliationRepository();
  readonly dailyFinancialConsolidationRepository =
    new InMemoryDailyFinancialConsolidationRepository();
  readonly productRepository = new InMemoryProductRepository();
  readonly employeeRepository = new InMemoryEmployeeRepository();
  readonly financialEntryRepository = new InMemoryFinancialEntryRepository();
  readonly inventoryLossEntryRepository = new InMemoryInventoryLossEntryRepository();
  readonly outboxEventRepository = new InMemoryOutboxEventRepository();
  readonly processedEventRepository = new InMemoryProcessedEventRepository();

  async execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T> {
    return work({
      cashReconciliationRepository: this.cashReconciliationRepository,
      dailyFinancialConsolidationRepository: this.dailyFinancialConsolidationRepository,
      productRepository: this.productRepository,
      employeeRepository: this.employeeRepository,
      financialEntryRepository: this.financialEntryRepository,
      inventoryLossEntryRepository: this.inventoryLossEntryRepository,
      outboxEventRepository: this.outboxEventRepository,
      processedEventRepository: this.processedEventRepository
    });
  }
}

export class FakeCredentialHasher implements CredentialHasherPort {
  async hash(rawValue: string): Promise<string> {
    return `hashed:${rawValue}`;
  }
}

export class FakeOutboxEventRelay implements OutboxEventRelayPort {
  readonly dispatchedEventIds: string[] = [];

  constructor(private readonly status: IntegrationEventPublicationStatus = 'published') {}

  async dispatch(eventId: string): Promise<IntegrationEventPublicationStatus> {
    this.dispatchedEventIds.push(eventId);

    return this.status;
  }
}

export function createSaleCompletedEventFixture(
  overrides: Partial<SaleCompletedEventPayload> = {}
): EventEnvelope<SaleCompletedEventPayload> {
  const payload: SaleCompletedEventPayload = {
    saleId: 'd0dcdb34-49ef-4629-9e11-8d4f90f3fe2e',
    sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424',
    registerId: 'register-01',
    operatorId: 'f6fb39a7-4561-42eb-b14b-5064bb66feb8',
    paymentMethod: SalePaymentMethod.Cash,
    paidAmount: 42.5,
    changeAmount: 0,
    totalItemsQuantity: 3,
    subtotal: 42.5,
    total: 42.5,
    completedAt: '2026-06-09T22:15:00.000Z',
    items: [
      {
        productId: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
        barcode: '7891000000410',
        name: 'Ground Coffee',
        unitOfMeasure: 'UNIT',
        unitPrice: 14.17,
        quantity: 3,
        lineTotal: 42.5
      }
    ],
    tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
    ...overrides
  };

  return {
    eventId: 'd508ab5f-a0e4-445f-b130-8237ca566f5e',
    eventName: 'SaleCompleted',
    topic: 'checkout.sale.completed',
    aggregateId: payload.saleId,
    tenantId: payload.tenantId,
    occurredAt: '2026-06-09T22:15:01.000Z',
    payload
  };
}

export function createSaleCanceledEventFixture(
  overrides: Partial<SaleCanceledEventPayload> = {}
): EventEnvelope<SaleCanceledEventPayload> {
  const payload: SaleCanceledEventPayload = {
    saleId: 'd0dcdb34-49ef-4629-9e11-8d4f90f3fe2e',
    sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424',
    registerId: 'register-01',
    operatorId: 'f6fb39a7-4561-42eb-b14b-5064bb66feb8',
    previousStatus: 'COMPLETED',
    paymentMethod: SalePaymentMethod.Cash,
    paidAmount: 42.5,
    changeAmount: 0,
    totalItemsQuantity: 3,
    subtotal: 42.5,
    total: 42.5,
    cancellationReason: 'Customer changed mind',
    canceledAt: '2026-06-09T22:17:00.000Z',
    items: [
      {
        productId: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
        barcode: '7891000000410',
        name: 'Ground Coffee',
        unitOfMeasure: 'UNIT',
        unitPrice: 14.17,
        quantity: 3,
        lineTotal: 42.5
      }
    ],
    tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
    ...overrides
  };

  return {
    eventId: '07dfd4d1-4df4-497f-87ca-a0e84861aacf',
    eventName: 'SaleCanceled',
    topic: 'checkout.sale.canceled',
    aggregateId: payload.saleId,
    tenantId: payload.tenantId,
    occurredAt: '2026-06-09T22:17:01.000Z',
    payload
  };
}

export function createRegisterClosedEventFixture(
  overrides: Partial<RegisterClosedEventPayload> = {}
): EventEnvelope<RegisterClosedEventPayload> {
  const payload: RegisterClosedEventPayload = {
    sessionId: 'd2d71326-db87-42b9-9d6d-58de8c4f8424',
    registerId: 'register-01',
    operatorId: 'f6fb39a7-4561-42eb-b14b-5064bb66feb8',
    openingFloatAmount: 100,
    declaredCashAmount: 142.5,
    closedAt: '2026-06-09T22:30:00.000Z',
    tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
    ...overrides
  };

  return {
    eventId: 'ff2caa51-99d9-4dcb-9117-70a6e1c7a991',
    eventName: 'RegisterClosed',
    topic: 'checkout.register.closed',
    aggregateId: payload.sessionId,
    tenantId: payload.tenantId,
    occurredAt: '2026-06-09T22:30:01.000Z',
    payload
  };
}

export function createInventoryLossRegisteredEventFixture(
  overrides: Partial<InventoryLossRegisteredEventPayload> = {}
): EventEnvelope<InventoryLossRegisteredEventPayload> {
  const payload: InventoryLossRegisteredEventPayload = {
    lossId: '1fe8633f-074d-495d-a534-5c1db96c28cf',
    stockMovementId: '6102b0fe-55ee-4df8-b70d-84f3e65aea67',
    productId: '8f84026c-9fdb-4e76-af24-4c5f48f0e8ec',
    barcode: '7891000000410',
    name: 'Ground Coffee',
    unitOfMeasure: 'UNIT',
    quantity: 2,
    reasonCode: InventoryLossReason.Damaged,
    notes: 'Broken package',
    onHandQuantityAfterLoss: 8,
    recordedAt: '2026-06-09T23:00:00.000Z',
    tenantId: 'eebf4667-1f0d-42d7-893b-b5da98f30239',
    ...overrides
  };

  return {
    eventId: 'db2920df-f14c-4438-8709-25cea1454a96',
    eventName: 'InventoryLossRegistered',
    topic: 'inventory.loss.registered',
    aggregateId: payload.lossId,
    tenantId: payload.tenantId,
    occurredAt: '2026-06-09T23:00:01.000Z',
    payload
  };
}

function buildKey(tenantId: string, resourceId: string): string {
  return `${tenantId}:${resourceId}`;
}
