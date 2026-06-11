import { DomainValidationError } from '@supermarket/shared-domain';

export type CashReconciliationStatus = 'BALANCED' | 'OVERAGE' | 'SHORTAGE';

export interface CashReconciliationPrimitives {
  id: string;
  tenantId: string;
  sourceEventId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  businessDate: string;
  openingFloatAmount: number;
  declaredCashAmount: number;
  expectedCashAmount: number;
  differenceAmount: number;
  status: CashReconciliationStatus;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface ReconcileCashRegisterInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  businessDate: string;
  openingFloatAmount: number;
  declaredCashAmount: number;
  expectedCashAmount: number;
  closedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateCashReconciliationInput {
  id: string;
  tenantId: string;
  sourceEventId: string;
  sessionId: string;
  registerId: string;
  operatorId: string;
  businessDate: string;
  openingFloatAmount: number;
  declaredCashAmount: number;
  expectedCashAmount: number;
  differenceAmount: number;
  status: CashReconciliationStatus;
  closedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export class CashReconciliation {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly sourceEventId: string,
    private readonly sessionId: string,
    private readonly registerId: string,
    private readonly operatorId: string,
    private readonly businessDate: string,
    private readonly openingFloatAmount: number,
    private readonly declaredCashAmount: number,
    private readonly expectedCashAmount: number,
    private readonly differenceAmount: number,
    private readonly status: CashReconciliationStatus,
    private readonly closedAt: Date,
    private readonly createdAt: Date,
    private readonly updatedAt: Date
  ) {}

  static reconcile(input: ReconcileCashRegisterInput): CashReconciliation {
    const createdAt = input.createdAt ?? new Date();
    const updatedAt = input.updatedAt ?? createdAt;
    const openingFloatAmount = normalizeMoney(input.openingFloatAmount, 'Opening float amount', true);
    const declaredCashAmount = normalizeMoney(input.declaredCashAmount, 'Declared cash amount', true);
    const expectedCashAmount = normalizeMoney(input.expectedCashAmount, 'Expected cash amount', true);
    const differenceAmount = Number.parseFloat(
      (declaredCashAmount - expectedCashAmount).toFixed(2)
    );

    return new CashReconciliation(
      normalizeRequiredString(input.id, 'Cash reconciliation id'),
      normalizeRequiredString(input.tenantId, 'Tenant id'),
      normalizeRequiredString(input.sourceEventId, 'Source event id'),
      normalizeRequiredString(input.sessionId, 'Session id'),
      normalizeRequiredString(input.registerId, 'Register id'),
      normalizeRequiredString(input.operatorId, 'Operator id'),
      normalizeBusinessDate(input.businessDate),
      openingFloatAmount,
      declaredCashAmount,
      expectedCashAmount,
      differenceAmount,
      resolveCashReconciliationStatus(differenceAmount),
      ensureDate(input.closedAt, 'Closed at'),
      ensureDate(createdAt, 'Created at'),
      ensureDate(updatedAt, 'Updated at')
    );
  }

  static rehydrate(input: RehydrateCashReconciliationInput): CashReconciliation {
    const openingFloatAmount = normalizeMoney(input.openingFloatAmount, 'Opening float amount', true);
    const declaredCashAmount = normalizeMoney(input.declaredCashAmount, 'Declared cash amount', true);
    const expectedCashAmount = normalizeMoney(input.expectedCashAmount, 'Expected cash amount', true);
    const differenceAmount = Number.parseFloat(
      (declaredCashAmount - expectedCashAmount).toFixed(2)
    );

    if (Number.parseFloat(input.differenceAmount.toFixed(2)) !== differenceAmount) {
      throw new DomainValidationError(
        'Difference amount must match the declared and expected cash values'
      );
    }

    if (resolveCashReconciliationStatus(differenceAmount) !== input.status) {
      throw new DomainValidationError('Cash reconciliation status does not match the difference amount');
    }

    return new CashReconciliation(
      normalizeRequiredString(input.id, 'Cash reconciliation id'),
      normalizeRequiredString(input.tenantId, 'Tenant id'),
      normalizeRequiredString(input.sourceEventId, 'Source event id'),
      normalizeRequiredString(input.sessionId, 'Session id'),
      normalizeRequiredString(input.registerId, 'Register id'),
      normalizeRequiredString(input.operatorId, 'Operator id'),
      normalizeBusinessDate(input.businessDate),
      openingFloatAmount,
      declaredCashAmount,
      expectedCashAmount,
      differenceAmount,
      input.status,
      ensureDate(input.closedAt, 'Closed at'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at')
    );
  }

  toPrimitives(): CashReconciliationPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sourceEventId: this.sourceEventId,
      sessionId: this.sessionId,
      registerId: this.registerId,
      operatorId: this.operatorId,
      businessDate: this.businessDate,
      openingFloatAmount: this.openingFloatAmount,
      declaredCashAmount: this.declaredCashAmount,
      expectedCashAmount: this.expectedCashAmount,
      differenceAmount: this.differenceAmount,
      status: this.status,
      closedAt: this.closedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}

function normalizeRequiredString(value: string, label: string): string {
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

function resolveCashReconciliationStatus(differenceAmount: number): CashReconciliationStatus {
  if (differenceAmount === 0) {
    return 'BALANCED';
  }

  return differenceAmount > 0 ? 'OVERAGE' : 'SHORTAGE';
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
