import { DomainValidationError } from '@supermarket/shared-domain';

export type StockMovementType = 'SALE_ISSUE';

export interface StockMovementPrimitives {
  id: string;
  tenantId: string;
  productId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  referenceId: string;
  referenceEventId: string;
  reason: string;
  occurredAt: string;
  createdAt: string;
}

interface RecordSaleIssueInput {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  referenceId: string;
  referenceEventId: string;
  occurredAt: Date;
  createdAt?: Date;
}

interface RehydrateStockMovementInput {
  id: string;
  tenantId: string;
  productId: string;
  movementType: StockMovementType;
  quantityDelta: number;
  referenceId: string;
  referenceEventId: string;
  reason: string;
  occurredAt: Date;
  createdAt: Date;
}

export class StockMovement {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly productId: string,
    private readonly movementType: StockMovementType,
    private readonly quantityDelta: number,
    private readonly referenceId: string,
    private readonly referenceEventId: string,
    private readonly reason: string,
    private readonly occurredAt: Date,
    private readonly createdAt: Date
  ) {}

  static recordSaleIssue(input: RecordSaleIssueInput): StockMovement {
    const quantity = normalizePositiveInteger(input.quantity, 'Sale issue quantity');

    return new StockMovement(
      normalizeIdentifier(input.id, 'Stock movement id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      'SALE_ISSUE',
      quantity * -1,
      normalizeIdentifier(input.referenceId, 'Reference id'),
      normalizeIdentifier(input.referenceEventId, 'Reference event id'),
      'Sale completed stock issue',
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt ?? input.occurredAt, 'Created at')
    );
  }

  static rehydrate(input: RehydrateStockMovementInput): StockMovement {
    if (input.movementType !== 'SALE_ISSUE') {
      throw new DomainValidationError(`Stock movement type ${input.movementType} is invalid`);
    }

    if (!Number.isInteger(input.quantityDelta) || input.quantityDelta >= 0) {
      throw new DomainValidationError('Sale issue stock movement must have a negative quantity delta');
    }

    return new StockMovement(
      normalizeIdentifier(input.id, 'Stock movement id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      input.movementType,
      input.quantityDelta,
      normalizeIdentifier(input.referenceId, 'Reference id'),
      normalizeIdentifier(input.referenceEventId, 'Reference event id'),
      normalizeRequiredString(input.reason, 'Reason'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  toPrimitives(): StockMovementPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      movementType: this.movementType,
      quantityDelta: this.quantityDelta,
      referenceId: this.referenceId,
      referenceEventId: this.referenceEventId,
      reason: this.reason,
      occurredAt: this.occurredAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }
}

function normalizeIdentifier(value: string, label: string): string {
  return normalizeRequiredString(value, label);
}

function normalizeRequiredString(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }

  return value;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
