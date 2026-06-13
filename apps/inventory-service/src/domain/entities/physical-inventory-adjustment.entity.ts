import { DomainValidationError } from '@supermarket/shared-domain';

export interface PhysicalInventoryAdjustmentPrimitives {
  id: string;
  tenantId: string;
  productId: string;
  collectorId: string;
  previousOnHandQuantity: number;
  countedQuantity: number;
  quantityDelta: number;
  minimumThreshold: number;
  reason: string;
  occurredAt: string;
  createdAt: string;
}

interface RecordPhysicalInventoryAdjustmentInput {
  id: string;
  tenantId: string;
  productId: string;
  collectorId: string;
  previousOnHandQuantity: number;
  countedQuantity: number;
  minimumThreshold: number;
  reason: string;
  occurredAt: Date;
  createdAt?: Date;
}

interface RehydratePhysicalInventoryAdjustmentInput {
  id: string;
  tenantId: string;
  productId: string;
  collectorId: string;
  previousOnHandQuantity: number;
  countedQuantity: number;
  quantityDelta: number;
  minimumThreshold: number;
  reason: string;
  occurredAt: Date;
  createdAt: Date;
}

export class PhysicalInventoryAdjustment {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly productId: string,
    private readonly collectorId: string,
    private readonly previousOnHandQuantity: number,
    private readonly countedQuantity: number,
    private readonly quantityDelta: number,
    private readonly minimumThreshold: number,
    private readonly reason: string,
    private readonly occurredAt: Date,
    private readonly createdAt: Date
  ) {}

  static record(
    input: RecordPhysicalInventoryAdjustmentInput
  ): PhysicalInventoryAdjustment {
    const createdAt = input.createdAt ?? new Date();
    const previousOnHandQuantity = normalizeInteger(
      input.previousOnHandQuantity,
      'Previous on-hand quantity'
    );
    const countedQuantity = normalizeWholeNumber(input.countedQuantity, 'Counted quantity');

    return new PhysicalInventoryAdjustment(
      normalizeIdentifier(input.id, 'Physical inventory adjustment id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.collectorId, 'Collector id'),
      previousOnHandQuantity,
      countedQuantity,
      countedQuantity - previousOnHandQuantity,
      normalizeWholeNumber(input.minimumThreshold, 'Minimum threshold'),
      normalizeReason(input.reason),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(createdAt, 'Created at')
    );
  }

  static rehydrate(
    input: RehydratePhysicalInventoryAdjustmentInput
  ): PhysicalInventoryAdjustment {
    return new PhysicalInventoryAdjustment(
      normalizeIdentifier(input.id, 'Physical inventory adjustment id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.collectorId, 'Collector id'),
      normalizeInteger(input.previousOnHandQuantity, 'Previous on-hand quantity'),
      normalizeWholeNumber(input.countedQuantity, 'Counted quantity'),
      normalizeInteger(input.quantityDelta, 'Quantity delta'),
      normalizeWholeNumber(input.minimumThreshold, 'Minimum threshold'),
      normalizeReason(input.reason),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  toPrimitives(): PhysicalInventoryAdjustmentPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      collectorId: this.collectorId,
      previousOnHandQuantity: this.previousOnHandQuantity,
      countedQuantity: this.countedQuantity,
      quantityDelta: this.quantityDelta,
      minimumThreshold: this.minimumThreshold,
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

function normalizeReason(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length < 3 || normalizedValue.length > 255) {
    throw new DomainValidationError('Physical inventory adjustment reason must have 3 to 255 characters');
  }

  return normalizedValue;
}

function normalizeWholeNumber(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainValidationError(`${label} must be greater than or equal to zero`);
  }

  return value;
}

function normalizeInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new DomainValidationError(`${label} must be an integer`);
  }

  return value;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
