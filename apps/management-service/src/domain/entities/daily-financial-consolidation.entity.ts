import { DomainValidationError } from '@supermarket/shared-domain';

import { FinancialEntry } from './financial-entry.entity';

export interface DailyFinancialConsolidationPrimitives {
  tenantId: string;
  businessDate: string;
  grossSalesTotal: number;
  salesCount: number;
  soldItemsQuantity: number;
  lastConsolidatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface InitializeDailyFinancialConsolidationInput {
  tenantId: string;
  businessDate: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateDailyFinancialConsolidationInput {
  tenantId: string;
  businessDate: string;
  grossSalesTotal: number;
  salesCount: number;
  soldItemsQuantity: number;
  lastConsolidatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class DailyFinancialConsolidation {
  private constructor(
    private readonly tenantId: string,
    private readonly businessDate: string,
    private grossSalesTotal: number,
    private salesCount: number,
    private soldItemsQuantity: number,
    private lastConsolidatedAt: Date,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static initialize(input: InitializeDailyFinancialConsolidationInput): DailyFinancialConsolidation {
    const now = input.createdAt ?? new Date();

    return new DailyFinancialConsolidation(
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBusinessDate(input.businessDate),
      0,
      0,
      0,
      now,
      now,
      input.updatedAt ?? now
    );
  }

  static rehydrate(
    input: RehydrateDailyFinancialConsolidationInput
  ): DailyFinancialConsolidation {
    return new DailyFinancialConsolidation(
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.grossSalesTotal, 'Gross sales total', true),
      normalizeNonNegativeInteger(input.salesCount, 'Sales count'),
      normalizeNonNegativeInteger(input.soldItemsQuantity, 'Sold items quantity'),
      ensureDate(input.lastConsolidatedAt, 'Last consolidated at'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at')
    );
  }

  applyFinancialEntry(entry: FinancialEntry, updatedAt: Date = new Date()): void {
    if (!entry.belongsToTenant(this.tenantId)) {
      throw new DomainValidationError('Financial entry tenant does not match consolidation tenant');
    }

    if (entry.occurredOnBusinessDate() !== this.businessDate) {
      throw new DomainValidationError(
        'Financial entry business date does not match consolidation business date'
      );
    }

    this.grossSalesTotal = Number.parseFloat(
      (this.grossSalesTotal + entry.contributesGrossSales()).toFixed(2)
    );
    this.salesCount += entry.contributesSalesCount();
    this.soldItemsQuantity += entry.contributesItemsQuantity();

    if (this.grossSalesTotal < 0 || this.salesCount < 0 || this.soldItemsQuantity < 0) {
      throw new DomainValidationError(
        'Daily financial consolidation cannot become negative after applying a financial entry'
      );
    }

    this.lastConsolidatedAt = maxDate(this.lastConsolidatedAt, new Date(entry.toPrimitives().occurredAt));
    this.updatedAt = ensureDate(updatedAt, 'Updated at');
  }

  toPrimitives(): DailyFinancialConsolidationPrimitives {
    return {
      tenantId: this.tenantId,
      businessDate: this.businessDate,
      grossSalesTotal: this.grossSalesTotal,
      salesCount: this.salesCount,
      soldItemsQuantity: this.soldItemsQuantity,
      lastConsolidatedAt: this.lastConsolidatedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
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

function normalizeMoney(value: number, label: string, allowZero: boolean = false): number {
  const minimum = allowZero ? 0 : Number.MIN_VALUE;

  if (!Number.isFinite(value) || value < minimum) {
    throw new DomainValidationError(
      allowZero ? `${label} cannot be negative` : `${label} must be greater than zero`
    );
  }

  return Number.parseFloat(value.toFixed(2));
}

function normalizeNonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainValidationError(`${label} cannot be negative`);
  }

  return value;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}

function maxDate(left: Date, right: Date): Date {
  return left.getTime() >= right.getTime() ? left : right;
}
