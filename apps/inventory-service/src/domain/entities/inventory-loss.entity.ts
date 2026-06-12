import { DomainValidationError, InventoryLossReason } from '@supermarket/shared-domain';

export interface InventoryLossPrimitives {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes: string | null;
  occurredAt: string;
  createdAt: string;
}

interface RecordInventoryLossInput {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes?: string | null;
  occurredAt: Date;
  createdAt?: Date;
}

interface RehydrateInventoryLossInput {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes: string | null;
  occurredAt: Date;
  createdAt: Date;
}

export class InventoryLoss {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly productId: string,
    private readonly quantity: number,
    private readonly reasonCode: InventoryLossReason,
    private readonly notes: string | null,
    private readonly occurredAt: Date,
    private readonly createdAt: Date
  ) {}

  static record(input: RecordInventoryLossInput): InventoryLoss {
    const createdAt = input.createdAt ?? new Date();

    return new InventoryLoss(
      normalizeIdentifier(input.id, 'Inventory loss id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizePositiveInteger(input.quantity, 'Inventory loss quantity'),
      normalizeReasonCode(input.reasonCode),
      normalizeOptionalNotes(input.notes),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(createdAt, 'Created at')
    );
  }

  static rehydrate(input: RehydrateInventoryLossInput): InventoryLoss {
    return new InventoryLoss(
      normalizeIdentifier(input.id, 'Inventory loss id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizePositiveInteger(input.quantity, 'Inventory loss quantity'),
      normalizeReasonCode(input.reasonCode),
      normalizeOptionalNotes(input.notes),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  toPrimitives(): InventoryLossPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      productId: this.productId,
      quantity: this.quantity,
      reasonCode: this.reasonCode,
      notes: this.notes,
      occurredAt: this.occurredAt.toISOString(),
      createdAt: this.createdAt.toISOString()
    };
  }
}

function normalizeIdentifier(value: string, label: string): string {
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

function normalizeReasonCode(value: InventoryLossReason): InventoryLossReason {
  if (!Object.values(InventoryLossReason).includes(value)) {
    throw new DomainValidationError(`Inventory loss reason ${value} is invalid`);
  }

  return value;
}

function normalizeOptionalNotes(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    return null;
  }

  if (normalizedValue.length > 255) {
    throw new DomainValidationError('Inventory loss notes cannot exceed 255 characters');
  }

  return normalizedValue;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
