import {
  DomainValidationError,
  SalePaymentMethod
} from '@supermarket/shared-domain';

export type FinancialEntryType = 'SALE_REVENUE';

export interface FinancialEntryPrimitives {
  id: string;
  tenantId: string;
  entryType: FinancialEntryType;
  sourceEventId: string;
  saleId: string;
  paymentMethod: SalePaymentMethod;
  businessDate: string;
  grossAmount: number;
  totalItemsQuantity: number;
  occurredAt: string;
  createdAt: string;
}

interface RecordSaleRevenueInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  saleId: string;
  paymentMethod: SalePaymentMethod;
  businessDate: string;
  grossAmount: number;
  totalItemsQuantity: number;
  occurredAt: Date;
  createdAt?: Date;
}

interface RehydrateFinancialEntryInput {
  id: string;
  tenantId: string;
  entryType: FinancialEntryType;
  sourceEventId: string;
  saleId: string;
  paymentMethod: SalePaymentMethod;
  businessDate: string;
  grossAmount: number;
  totalItemsQuantity: number;
  occurredAt: Date;
  createdAt: Date;
}

export class FinancialEntry {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly entryType: FinancialEntryType,
    private readonly sourceEventId: string,
    private readonly saleId: string,
    private readonly paymentMethod: SalePaymentMethod,
    private readonly businessDate: string,
    private readonly grossAmount: number,
    private readonly totalItemsQuantity: number,
    private readonly occurredAt: Date,
    private readonly createdAt: Date
  ) {}

  static recordSaleRevenue(input: RecordSaleRevenueInput): FinancialEntry {
    const createdAt = input.createdAt ?? new Date();

    return new FinancialEntry(
      normalizeIdentifier(input.id, 'Financial entry id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      'SALE_REVENUE',
      normalizeIdentifier(input.sourceEventId, 'Source event id'),
      normalizeIdentifier(input.saleId, 'Sale id'),
      input.paymentMethod,
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.grossAmount, 'Gross amount'),
      normalizeQuantity(input.totalItemsQuantity, 'Total items quantity'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(createdAt, 'Created at')
    );
  }

  static rehydrate(input: RehydrateFinancialEntryInput): FinancialEntry {
    return new FinancialEntry(
      normalizeIdentifier(input.id, 'Financial entry id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeEntryType(input.entryType),
      normalizeIdentifier(input.sourceEventId, 'Source event id'),
      normalizeIdentifier(input.saleId, 'Sale id'),
      input.paymentMethod,
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.grossAmount, 'Gross amount'),
      normalizeQuantity(input.totalItemsQuantity, 'Total items quantity'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  contributesGrossSales(): number {
    return this.grossAmount;
  }

  contributesItemsQuantity(): number {
    return this.totalItemsQuantity;
  }

  occurredOnBusinessDate(): string {
    return this.businessDate;
  }

  belongsToTenant(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }

  toPrimitives(): FinancialEntryPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      entryType: this.entryType,
      sourceEventId: this.sourceEventId,
      saleId: this.saleId,
      paymentMethod: this.paymentMethod,
      businessDate: this.businessDate,
      grossAmount: this.grossAmount,
      totalItemsQuantity: this.totalItemsQuantity,
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

function normalizeQuantity(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }

  return value;
}

function normalizeEntryType(value: FinancialEntryType): FinancialEntryType {
  if (value !== 'SALE_REVENUE') {
    throw new DomainValidationError(`Financial entry type ${value} is not supported`);
  }

  return value;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
