import { ConflictError, DomainValidationError } from '@supermarket/shared-domain';

export type PosSessionStatus = 'OPEN' | 'CLOSED';

export interface PosSessionPrimitives {
  id: string;
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  declaredCashAmount: number | null;
  status: PosSessionStatus;
  openedAt: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OpenPosSessionInput {
  id: string;
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  openedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydratePosSessionInput {
  id: string;
  tenantId: string;
  registerId: string;
  operatorId: string;
  openingFloatAmount: number;
  declaredCashAmount: number | null;
  status: PosSessionStatus;
  openedAt: Date;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface ClosePosSessionInput {
  declaredCashAmount: number;
  closedAt?: Date;
  updatedAt?: Date;
}

export class PosSession {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly registerId: string,
    private readonly operatorId: string,
    private readonly openingFloatAmount: number,
    private declaredCashAmount: number | null,
    private status: PosSessionStatus,
    private readonly openedAt: Date,
    private closedAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static open(input: OpenPosSessionInput): PosSession {
    const now = input.openedAt ?? new Date();
    const createdAt = ensureDate(input.createdAt ?? now, 'Created at');
    const updatedAt = ensureDate(input.updatedAt ?? now, 'Updated at');

    return new PosSession(
      normalizeIdentifier(input.id, 'POS session id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeRequiredString(input.registerId, 'Register id'),
      normalizeIdentifier(input.operatorId, 'Operator id'),
      normalizeMoneyAmount(input.openingFloatAmount, 'Opening float amount'),
      null,
      'OPEN',
      ensureDate(now, 'Opened at'),
      null,
      createdAt,
      updatedAt
    );
  }

  static rehydrate(input: RehydratePosSessionInput): PosSession {
    const openedAt = ensureDate(input.openedAt, 'Opened at');
    const closedAt = input.closedAt ? ensureDate(input.closedAt, 'Closed at') : null;
    const createdAt = ensureDate(input.createdAt, 'Created at');
    const updatedAt = ensureDate(input.updatedAt, 'Updated at');
    const status = normalizeStatus(input.status);
    const declaredCashAmount = normalizeNullableMoneyAmount(
      input.declaredCashAmount,
      'Declared cash amount'
    );

    if (status === 'OPEN' && closedAt) {
      throw new DomainValidationError('Open POS sessions cannot have a close timestamp');
    }

    if (status === 'OPEN' && declaredCashAmount !== null) {
      throw new DomainValidationError('Open POS sessions cannot have a declared cash amount');
    }

    if (status === 'CLOSED' && !closedAt) {
      throw new DomainValidationError('Closed POS sessions must have a close timestamp');
    }

    if (status === 'CLOSED' && declaredCashAmount === null) {
      throw new DomainValidationError('Closed POS sessions must have a declared cash amount');
    }

    return new PosSession(
      normalizeIdentifier(input.id, 'POS session id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeRequiredString(input.registerId, 'Register id'),
      normalizeIdentifier(input.operatorId, 'Operator id'),
      normalizeMoneyAmount(input.openingFloatAmount, 'Opening float amount'),
      declaredCashAmount,
      status,
      openedAt,
      closedAt,
      createdAt,
      updatedAt
    );
  }

  assertOpen(): void {
    if (this.status !== 'OPEN') {
      throw new ConflictError(`POS session ${this.id} is not open for tenant ${this.tenantId}`);
    }
  }

  close(input: ClosePosSessionInput): void {
    this.assertOpen();

    const closedAt = ensureDate(input.closedAt ?? new Date(), 'Closed at');

    this.declaredCashAmount = normalizeMoneyAmount(
      input.declaredCashAmount,
      'Declared cash amount'
    );
    this.status = 'CLOSED';
    this.closedAt = closedAt;
    this.updatedAt = ensureDate(input.updatedAt ?? closedAt, 'Updated at');
  }

  toPrimitives(): PosSessionPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      registerId: this.registerId,
      operatorId: this.operatorId,
      openingFloatAmount: this.openingFloatAmount,
      declaredCashAmount: this.declaredCashAmount,
      status: this.status,
      openedAt: this.openedAt.toISOString(),
      closedAt: this.closedAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
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

function normalizeMoneyAmount(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(`${label} must be greater than or equal to zero`);
  }

  return Number.parseFloat(value.toFixed(2));
}

function normalizeNullableMoneyAmount(value: number | null, label: string): number | null {
  if (value === null) {
    return null;
  }

  return normalizeMoneyAmount(value, label);
}

function normalizeStatus(status: PosSessionStatus): PosSessionStatus {
  if (status !== 'OPEN' && status !== 'CLOSED') {
    throw new DomainValidationError(`POS session status ${status} is invalid`);
  }

  return status;
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
