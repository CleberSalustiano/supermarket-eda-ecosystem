import {
  DomainValidationError,
  SalePaymentMethod
} from '@supermarket/shared-domain';

export type FinancialEntryType = 'SALE_REVENUE' | 'SALE_CANCELLATION_REVERSAL';

export interface FinancialEntryPrimitives {
  id: string;
  tenantId: string;
  entryType: FinancialEntryType;
  sourceEventId: string;
  saleId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
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
  sessionId: string;
  registerId: string;
  operatorId: string;
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
  sessionId: string;
  registerId: string;
  operatorId: string;
  paymentMethod: SalePaymentMethod;
  businessDate: string;
  grossAmount: number;
  totalItemsQuantity: number;
  occurredAt: Date;
  createdAt: Date;
}

interface RecordSaleCancellationReversalInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  saleId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  paymentMethod: SalePaymentMethod;
  businessDate: string;
  grossAmount: number;
  totalItemsQuantity: number;
  occurredAt: Date;
  createdAt?: Date;
}

export class FinancialEntry {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly entryType: FinancialEntryType,
    private readonly sourceEventId: string,
    private readonly saleId: string,
    private readonly sessionId: string,
    private readonly registerId: string,
    private readonly operatorId: string,
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
      normalizeIdentifier(input.sessionId, 'Session id'),
      normalizeIdentifier(input.registerId, 'Register id'),
      normalizeIdentifier(input.operatorId, 'Operator id'),
      input.paymentMethod,
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.grossAmount, 'Gross amount'),
      normalizeQuantity(input.totalItemsQuantity, 'Total items quantity'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(createdAt, 'Created at')
    );
  }

  static recordSaleCancellationReversal(
    input: RecordSaleCancellationReversalInput
  ): FinancialEntry {
    const createdAt = input.createdAt ?? new Date();

    return new FinancialEntry(
      normalizeIdentifier(input.id, 'Financial entry id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      'SALE_CANCELLATION_REVERSAL',
      normalizeIdentifier(input.sourceEventId, 'Source event id'),
      normalizeIdentifier(input.saleId, 'Sale id'),
      normalizeIdentifier(input.sessionId, 'Session id'),
      normalizeIdentifier(input.registerId, 'Register id'),
      normalizeIdentifier(input.operatorId, 'Operator id'),
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
      normalizeIdentifier(input.sessionId, 'Session id'),
      normalizeIdentifier(input.registerId, 'Register id'),
      normalizeIdentifier(input.operatorId, 'Operator id'),
      input.paymentMethod,
      normalizeBusinessDate(input.businessDate),
      normalizeMoney(input.grossAmount, 'Gross amount'),
      normalizeQuantity(input.totalItemsQuantity, 'Total items quantity'),
      ensureDate(input.occurredAt, 'Occurred at'),
      ensureDate(input.createdAt, 'Created at')
    );
  }

  contributesGrossSales(): number {
    return this.entryType === 'SALE_REVENUE' ? this.grossAmount : this.grossAmount * -1;
  }

  contributesItemsQuantity(): number {
    return this.entryType === 'SALE_REVENUE'
      ? this.totalItemsQuantity
      : this.totalItemsQuantity * -1;
  }

  contributesSalesCount(): number {
    return this.entryType === 'SALE_REVENUE' ? 1 : -1;
  }

  contributesNetCash(): number {
    if (this.paymentMethod !== SalePaymentMethod.Cash) {
      return 0;
    }

    return this.entryType === 'SALE_REVENUE' ? this.grossAmount : this.grossAmount * -1;
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
      sessionId: this.sessionId,
      registerId: this.registerId,
      operatorId: this.operatorId,
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
  if (value !== 'SALE_REVENUE' && value !== 'SALE_CANCELLATION_REVERSAL') {
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
