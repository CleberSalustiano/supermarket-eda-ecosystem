import { ConflictError, DomainValidationError, ResourceNotFoundError } from '@supermarket/shared-domain';

import type { RehydrateSaleItemInput, SaleItemPrimitives } from './sale-item.entity';
import { SaleItem } from './sale-item.entity';

export type SaleStatus = 'OPEN' | 'PAID' | 'COMPLETED' | 'CANCELED';

export interface SalePrimitives {
  id: string;
  tenantId: string;
  sessionId: string;
  status: SaleStatus;
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

export class Sale {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly sessionId: string,
    private status: SaleStatus,
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

function normalizeStatus(status: SaleStatus): SaleStatus {
  if (status !== 'OPEN' && status !== 'PAID' && status !== 'COMPLETED' && status !== 'CANCELED') {
    throw new DomainValidationError(`Sale status ${status} is invalid`);
  }

  return status;
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

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
