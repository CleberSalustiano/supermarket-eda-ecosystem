import type { EventEnvelope, EventPayload } from '@supermarket/shared-domain';

import { Employee } from '../../src/domain/entities/employee.entity';
import { Product } from '../../src/domain/entities/product.entity';
import type {
  CredentialHasherPort
} from '../../src/application/ports/credential-hasher.port';
import type {
  ManagementTransactionContext,
  ManagementTransactionRunnerPort
} from '../../src/application/ports/management-transaction-runner.port';
import type { OutboxEventRelayPort } from '../../src/application/ports/outbox-event-relay.port';
import type {
  OutboxEventRepositoryPort,
  StoredOutboxEvent
} from '../../src/application/ports/outbox-event-repository.port';
import type { EmployeeRepositoryPort } from '../../src/domain/repositories/employee.repository';
import type { ProductRepositoryPort } from '../../src/domain/repositories/product.repository';
import type { IntegrationEventPublicationStatus } from '../../src/application/dto/integration-event-publication-status';

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

    if (event === undefined) {
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

    if (event === undefined) {
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
  readonly productRepository = new InMemoryProductRepository();
  readonly employeeRepository = new InMemoryEmployeeRepository();
  readonly outboxEventRepository = new InMemoryOutboxEventRepository();

  async execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T> {
    return work({
      productRepository: this.productRepository,
      employeeRepository: this.employeeRepository,
      outboxEventRepository: this.outboxEventRepository
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

function buildKey(tenantId: string, resourceId: string): string {
  return `${tenantId}:${resourceId}`;
}
