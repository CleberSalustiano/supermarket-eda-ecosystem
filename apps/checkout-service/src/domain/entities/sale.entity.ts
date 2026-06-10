import {
  ConflictError,
  DomainValidationError,
  ResourceNotFoundError,
  SalePaymentMethod
} from '@supermarket/shared-domain';

import type { RehydrateSaleItemInput, SaleItemPrimitives } from './sale-item.entity';
import { SaleItem } from './sale-item.entity';

export type SaleStatus = 'OPEN' | 'PAID' | 'COMPLETED' | 'CANCELED';

export interface SalePrimitives {
  id: string;
  tenantId: string;
  sessionId: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
  paidAt: string | null;
  completedAt: string | null;
  canceledAt: string | null;
  cancellationReason: string | null;
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  items: SaleItemPrimitives[];
  createdAt: string;
  updatedAt: string;
}

interface StartSaleInput {
  id: string;
  tenantId: string;
  sessionId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateSaleInput {
  id: string;
  tenantId: string;
  sessionId: string;
  status: SaleStatus;
  paymentMethod: SalePaymentMethod | null;
  paidAmount: number | null;
  changeAmount: number | null;
  paidAt: Date | null;
  completedAt: Date | null;
  canceledAt: Date | null;
  cancellationReason: string | null;
  totalItemsQuantity: number;
  subtotal: number;
  total: number;
  items: RehydrateSaleItemInput[];
  createdAt: Date;
  updatedAt: Date;
}

interface AddSaleItemInput {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
}

interface RegisterPaymentInput {
  paymentMethod: SalePaymentMethod;
  paidAmount: number;
  updatedAt?: Date;
  paidAt?: Date;
}

interface CancelSaleInput {
  reason: string;
  managerApprovalCode?: string;
  canceledAt?: Date;
  updatedAt?: Date;
}

export class Sale {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly sessionId: string,
    private status: SaleStatus,
    private paymentMethod: SalePaymentMethod | null,
    private paidAmount: number | null,
    private changeAmount: number | null,
    private paidAt: Date | null,
    private completedAt: Date | null,
    private canceledAt: Date | null,
    private cancellationReason: string | null,
    private items: SaleItem[],
    private totalItemsQuantity: number,
    private subtotal: number,
    private total: number,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static start(input: StartSaleInput): Sale {
    const now = input.createdAt ?? new Date();
    const createdAt = ensureDate(input.createdAt ?? now, 'Created at');
    const updatedAt = ensureDate(input.updatedAt ?? now, 'Updated at');

    return new Sale(
      normalizeIdentifier(input.id, 'Sale id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.sessionId, 'POS session id'),
      'OPEN',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
      [],
      0,
      0,
      0,
      createdAt,
      updatedAt
    );
  }

  static rehydrate(input: RehydrateSaleInput): Sale {
    const items = input.items.map((item) => SaleItem.rehydrate(item));
    const sale = new Sale(
      normalizeIdentifier(input.id, 'Sale id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeIdentifier(input.sessionId, 'POS session id'),
      normalizeStatus(input.status),
      normalizePaymentMethod(input.paymentMethod),
      normalizeNullableMoney(input.paidAmount, 'Paid amount'),
      normalizeNullableMoney(input.changeAmount, 'Change amount', true),
      input.paidAt ? ensureDate(input.paidAt, 'Paid at') : null,
      input.completedAt ? ensureDate(input.completedAt, 'Completed at') : null,
      input.canceledAt ? ensureDate(input.canceledAt, 'Canceled at') : null,
      normalizeNullableRequiredString(input.cancellationReason, 'Cancellation reason'),
      items,
      normalizeAggregateQuantity(input.totalItemsQuantity, 'Sale total items quantity'),
      normalizeAggregateTotal(input.subtotal, 'Sale subtotal'),
      normalizeAggregateTotal(input.total, 'Sale total'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at')
    );

    sale.assertConsistentTotals();

    return sale;
  }

  addItem(input: AddSaleItemInput, updatedAt: Date = new Date()): void {
    this.assertOpen();

    const normalizedProductId = normalizeIdentifier(input.productId, 'Product id');
    const quantity = normalizeQuantity(input.quantity);
    const existingItem = this.items.find((item) => item.matchesProduct(normalizedProductId));

    if (existingItem) {
      existingItem.increaseQuantity(quantity);
    } else {
      this.items.push(
        SaleItem.create({
          productId: normalizedProductId,
          barcode: input.barcode,
          name: input.name,
          unitOfMeasure: input.unitOfMeasure,
          unitPrice: input.unitPrice,
          quantity
        })
      );
    }

    this.recalculateTotals();
    this.updatedAt = ensureDate(updatedAt, 'Updated at');
  }

  removeItem(barcode: string, quantity: number, updatedAt: Date = new Date()): void {
    this.assertOpen();

    const normalizedBarcode = normalizeRequiredString(barcode, 'Barcode');
    const itemIndex = this.items.findIndex((item) => item.matchesBarcode(normalizedBarcode));

    if (itemIndex < 0) {
      throw new ResourceNotFoundError(
        `Barcode ${normalizedBarcode} is not present in sale ${this.id} for tenant ${this.tenantId}`
      );
    }

    const item = this.items[itemIndex];

    if (!item) {
      throw new ResourceNotFoundError(
        `Barcode ${normalizedBarcode} is not present in sale ${this.id} for tenant ${this.tenantId}`
      );
    }

    item.decreaseQuantity(quantity);

    if (item.isEmpty()) {
      this.items.splice(itemIndex, 1);
    }

    this.recalculateTotals();
    this.updatedAt = ensureDate(updatedAt, 'Updated at');
  }

  registerPayment(input: RegisterPaymentInput): void {
    this.assertOpen();

    if (this.totalItemsQuantity === 0 || this.total <= 0) {
      throw new ConflictError(`Sale ${this.id} cannot be paid because the cart is empty`);
    }

    const paymentMethod = normalizeNonNullPaymentMethod(input.paymentMethod);
    const paidAmount = normalizeMoney(input.paidAmount, 'Paid amount');
    const paidAt = ensureDate(input.paidAt ?? new Date(), 'Paid at');
    const updatedAt = ensureDate(input.updatedAt ?? paidAt, 'Updated at');
    const changeAmount =
      paymentMethod === SalePaymentMethod.Cash ? roundMoney(paidAmount - this.total) : 0;

    if (paymentMethod === SalePaymentMethod.Cash && paidAmount < this.total) {
      throw new ConflictError(
        `Paid amount ${paidAmount} is insufficient for cash payment on sale ${this.id}`
      );
    }

    if (paymentMethod !== SalePaymentMethod.Cash && paidAmount !== this.total) {
      throw new ConflictError(
        `Paid amount ${paidAmount} must match the sale total ${this.total} for ${paymentMethod} payments`
      );
    }

    this.paymentMethod = paymentMethod;
    this.paidAmount = paidAmount;
    this.changeAmount = changeAmount;
    this.paidAt = paidAt;
    this.status = 'PAID';
    this.updatedAt = updatedAt;
  }

  complete(completedAt: Date = new Date()): void {
    if (this.status !== 'PAID') {
      throw new ConflictError(`Sale ${this.id} must be paid before completion`);
    }

    if (!this.paymentMethod || this.paidAmount === null || this.changeAmount === null || !this.paidAt) {
      throw new DomainValidationError(`Sale ${this.id} is missing payment data for completion`);
    }

    if (this.totalItemsQuantity === 0 || this.total <= 0) {
      throw new ConflictError(`Sale ${this.id} cannot be completed because the cart is empty`);
    }

    const normalizedCompletedAt = ensureDate(completedAt, 'Completed at');

    this.status = 'COMPLETED';
    this.completedAt = normalizedCompletedAt;
    this.updatedAt = normalizedCompletedAt;
  }

  cancel(input: CancelSaleInput): void {
    if (this.status === 'CANCELED') {
      throw new ConflictError(`Sale ${this.id} is already canceled for tenant ${this.tenantId}`);
    }

    if (this.status !== 'OPEN' && this.status !== 'PAID' && this.status !== 'COMPLETED') {
      throw new ConflictError(`Sale ${this.id} cannot be canceled from status ${this.status}`);
    }

    if (this.status !== 'OPEN' && !input.managerApprovalCode?.trim()) {
      throw new ConflictError(
        `Sale ${this.id} requires manager approval before cancellation after payment`
      );
    }

    const canceledAt = ensureDate(input.canceledAt ?? new Date(), 'Canceled at');

    this.status = 'CANCELED';
    this.cancellationReason = normalizeRequiredString(input.reason, 'Cancellation reason');
    this.canceledAt = canceledAt;
    this.updatedAt = ensureDate(input.updatedAt ?? canceledAt, 'Updated at');
  }

  assertOpen(): void {
    if (this.status !== 'OPEN') {
      throw new ConflictError(`Sale ${this.id} is not open for tenant ${this.tenantId}`);
    }
  }

  toPrimitives(): SalePrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      sessionId: this.sessionId,
      status: this.status,
      paymentMethod: this.paymentMethod,
      paidAmount: this.paidAmount,
      changeAmount: this.changeAmount,
      paidAt: this.paidAt?.toISOString() ?? null,
      completedAt: this.completedAt?.toISOString() ?? null,
      canceledAt: this.canceledAt?.toISOString() ?? null,
      cancellationReason: this.cancellationReason,
      totalItemsQuantity: this.totalItemsQuantity,
      subtotal: this.subtotal,
      total: this.total,
      items: this.items.map((item) => item.toPrimitives()),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  private recalculateTotals(): void {
    this.totalItemsQuantity = this.items.reduce((sum, item) => sum + item.toPrimitives().quantity, 0);
    this.subtotal = roundMoney(
      this.items.reduce((sum, item) => sum + item.toPrimitives().lineTotal, 0)
    );
    this.total = this.subtotal;
  }

  private assertConsistentTotals(): void {
    const expectedTotalItemsQuantity = this.items.reduce(
      (sum, item) => sum + item.toPrimitives().quantity,
      0
    );
    const expectedSubtotal = roundMoney(
      this.items.reduce((sum, item) => sum + item.toPrimitives().lineTotal, 0)
    );

    if (this.totalItemsQuantity !== expectedTotalItemsQuantity) {
      throw new DomainValidationError(
        `Sale total items quantity ${this.totalItemsQuantity} does not match the calculated amount ${expectedTotalItemsQuantity}`
      );
    }

    if (this.subtotal !== expectedSubtotal) {
      throw new DomainValidationError(
        `Sale subtotal ${this.subtotal} does not match the calculated amount ${expectedSubtotal}`
      );
    }

    if (this.total !== expectedSubtotal) {
      throw new DomainValidationError(
        `Sale total ${this.total} does not match the calculated amount ${expectedSubtotal}`
      );
    }

    if (this.status === 'OPEN') {
      if (
        this.paymentMethod ||
        this.paidAmount !== null ||
        this.changeAmount !== null ||
        this.paidAt ||
        this.completedAt ||
        this.canceledAt ||
        this.cancellationReason
      ) {
        throw new DomainValidationError('Open sales cannot contain payment or completion data');
      }

      return;
    }

    if (this.status === 'CANCELED') {
      if (!this.canceledAt || !this.cancellationReason) {
        throw new DomainValidationError(`Canceled sale ${this.id} must contain cancellation data`);
      }

      const containsAnyPaymentData =
        this.paymentMethod !== null ||
        this.paidAmount !== null ||
        this.changeAmount !== null ||
        this.paidAt !== null ||
        this.completedAt !== null;

      if (
        containsAnyPaymentData &&
        (!this.paymentMethod ||
          this.paidAmount === null ||
          this.changeAmount === null ||
          !this.paidAt)
      ) {
        throw new DomainValidationError(
          `Canceled sale ${this.id} must preserve complete payment data when payment exists`
        );
      }

      if (this.completedAt && !this.paidAt) {
        throw new DomainValidationError(
          `Canceled sale ${this.id} cannot have a completion timestamp without payment data`
        );
      }

      return;
    }

    if (this.status !== 'PAID' && this.status !== 'COMPLETED') {
      return;
    }

    if (
      !this.paymentMethod ||
      this.paidAmount === null ||
      this.changeAmount === null ||
      !this.paidAt
    ) {
      throw new DomainValidationError(
        `Sale ${this.id} must contain payment data when it is not open`
      );
    }

    if (this.status === 'COMPLETED' && !this.completedAt) {
      throw new DomainValidationError(`Completed sale ${this.id} must contain a completion timestamp`);
    }

    if (this.status !== 'COMPLETED' && this.completedAt) {
      throw new DomainValidationError(`Only completed sales may contain a completion timestamp`);
    }

    if (this.canceledAt || this.cancellationReason) {
      throw new DomainValidationError(`Non-canceled sale ${this.id} cannot contain cancellation data`);
    }
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

function normalizeNullableRequiredString(
  value: string | null | undefined,
  label: string
): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return normalizeRequiredString(value, label);
}

function normalizeStatus(status: SaleStatus): SaleStatus {
  if (status !== 'OPEN' && status !== 'PAID' && status !== 'COMPLETED' && status !== 'CANCELED') {
    throw new DomainValidationError(`Sale status ${status} is invalid`);
  }

  return status;
}

function normalizePaymentMethod(
  value: SalePaymentMethod | null
): SalePaymentMethod | null {
  if (value === null) {
    return null;
  }

  return normalizeNonNullPaymentMethod(value);
}

function normalizeNonNullPaymentMethod(value: SalePaymentMethod): SalePaymentMethod {
  if (
    value !== SalePaymentMethod.Cash &&
    value !== SalePaymentMethod.CreditCard &&
    value !== SalePaymentMethod.DebitCard &&
    value !== SalePaymentMethod.Pix &&
    value !== SalePaymentMethod.Voucher
  ) {
    throw new DomainValidationError(`Sale payment method ${value} is invalid`);
  }

  return value;
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError('Sale quantity must be a positive integer');
  }

  return value;
}

function normalizeAggregateQuantity(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainValidationError(`${label} must be greater than or equal to zero`);
  }

  return value;
}

function normalizeAggregateTotal(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(`${label} must be greater than or equal to zero`);
  }

  return roundMoney(value);
}

function normalizeMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be greater than zero`);
  }

  return roundMoney(value);
}

function normalizeNullableMoney(
  value: number | null,
  label: string,
  allowZero: boolean = false
): number | null {
  if (value === null) {
    return null;
  }

  if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
    const comparator = allowZero ? 'greater than or equal to zero' : 'greater than zero';
    throw new DomainValidationError(`${label} must be ${comparator}`);
  }

  return roundMoney(value);
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
