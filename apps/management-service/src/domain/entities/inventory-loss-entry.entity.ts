import {
  DomainValidationError,
  InventoryLossReason
} from '@supermarket/shared-domain';

export interface InventoryLossEntryPrimitives {
  id: string;
  tenantId: string;
  sourceEventId: string;
  lossId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes: string | null;
  businessDate: string;
  unitPrice: number;
  totalLossAmount: number;
  occurredAt: string;
  createdAt: string;
}

interface RecordInventoryLossEntryInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  lossId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes?: string | null;
  businessDate: string;
  unitPrice: number;
  occurredAt: Date;
  createdAt?: Date;
}

interface RehydrateInventoryLossEntryInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  lossId: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  reasonCode: InventoryLossReason;
  notes: string | null;
  businessDate: string;
  unitPrice: number;
  totalLossAmount: number;
  occurredAt: Date;
  createdAt: Date;
}

export class InventoryLossEntry {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly sourceEventId: string,
    private readonly lossId: string,
    private readonly productId: string,
    private readonly barcode: string,
    private readonly name: string,
    private readonly unitOfMeasure: string,
    private readonly quantity: number,
    private readonly reasonCode: InventoryLossReason,
    private readonly notes: string | null,
    private readonly businessDate: string,
    private readonly unitPrice: number,
    private readonly totalLossAmount: number,
    private readonly occurredAt: Date,
    private readonly createdAt: Date
  ) {}

  static record(input: RecordInventoryLossEntryInput): InventoryLossEntry {
    const createdAt = input.createdAt ?? new Date();
    const quantity = normalizeQuantity(input.quantity);
    const unitPrice = normalizeMoney(input.unitPrice, 'Inventory loss unit price');

    return new InventoryLossEntry(
      normalizeIdentifier(input.id, 'Inventory loss entry id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.sourceEventId, 'Source event id'),
      normalizeIdentifier(input.lossId, 'Inventory loss id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeRequiredString(input.barcode, 'Product barcode'),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeRequiredString(input.unitOfMeasure, 'Product unit of measure').toUpperCase(),
      quantity,
      normalizeReasonCode(input.reasonCode),
      normalizeNotes(input.notes),
      normalizeBusinessDate(input.businessDate),
      unitPrice,
      Number.parseFloat((quantity * unitPrice).toFixed(2)),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(createdAt, 'Created at')
    );
  }

  static rehydrate(input: RehydrateInventoryLossEntryInput): InventoryLossEntry {
    return new InventoryLossEntry(
      normalizeIdentifier(input.id, 'Inventory loss entry id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.sourceEventId, 'Source event id'),
      normalizeIdentifier(input.lossId, 'Inventory loss id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeRequiredString(input.barcode, 'Product barcode'),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeRequiredString(input.unitOfMeasure, 'Product unit of measure').toUpperCase(),
      normalizeQuantity(input.quantity),
      normalizeReasonCode(input.reasonCode),
      normalizeNotes(input.notes),
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.unitPrice, 'Inventory loss unit price'),
      normalizeMoney(input.totalLossAmount, 'Inventory loss total amount'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }

  occurredOnBusinessDate(): string {
    return this.businessDate;
  }

  totalAmount(): number {
    return this.totalLossAmount;
  }

  quantityValue(): number {
    return this.quantity;
  }

  toPrimitives(): InventoryLossEntryPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sourceEventId: this.sourceEventId,
      lossId: this.lossId,
      productId: this.productId,
      barcode: this.barcode,
      name: this.name,
      unitOfMeasure: this.unitOfMeasure,
      quantity: this.quantity,
      reasonCode: this.reasonCode,
      notes: this.notes,
      businessDate: this.businessDate,
      unitPrice: this.unitPrice,
      totalLossAmount: this.totalLossAmount,
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

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError('Inventory loss quantity must be a positive integer');
  }

  return value;
}

function normalizeReasonCode(value: InventoryLossReason): InventoryLossReason {
  if (!Object.values(InventoryLossReason).includes(value)) {
    throw new DomainValidationError(`Inventory loss reason ${value} is not supported`);
  }

  return value;
}

function normalizeNotes(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalizedValue = value.trim();

  return normalizedValue.length === 0 ? null : normalizedValue;
}

function normalizeBusinessDate(value: string): string {
  const normalizedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new DomainValidationError('Business date must use the YYYY-MM-DD format');
  }

  return normalizedValue;
}

function normalizeMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be greater than zero`);
  }

  return Number.parseFloat(value.toFixed(2));
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
