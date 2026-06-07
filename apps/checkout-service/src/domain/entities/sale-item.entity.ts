import { ConflictError, DomainValidationError } from '@supermarket/shared-domain';

export interface SaleItemPrimitives {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

interface CreateSaleItemInput {
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  quantity: number;
}

export interface RehydrateSaleItemInput extends CreateSaleItemInput {
  lineTotal: number;
}

export class SaleItem {
  private constructor(
    private readonly productId: string,
    private readonly barcode: string,
    private readonly name: string,
    private readonly unitOfMeasure: string,
    private readonly unitPrice: number,
    private quantity: number,
    private lineTotal: number
  ) {}

  static create(input: CreateSaleItemInput): SaleItem {
    const quantity = normalizeQuantity(input.quantity);
    const unitPrice = normalizeMoney(input.unitPrice);

    return new SaleItem(
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeBarcode(input.barcode),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeUnitOfMeasure(input.unitOfMeasure),
      unitPrice,
      quantity,
      roundMoney(unitPrice * quantity)
    );
  }

  static rehydrate(input: RehydrateSaleItemInput): SaleItem {
    const item = SaleItem.create(input);
    const expectedLineTotal = roundMoney(item.unitPrice * item.quantity);
    const lineTotal = normalizeLineTotal(input.lineTotal);

    if (lineTotal !== expectedLineTotal) {
      throw new DomainValidationError(
        `Sale item line total ${lineTotal} does not match the calculated amount ${expectedLineTotal}`
      );
    }

    item.lineTotal = lineTotal;

    return item;
  }

  increaseQuantity(quantity: number): void {
    this.quantity += normalizeQuantity(quantity);
    this.lineTotal = roundMoney(this.unitPrice * this.quantity);
  }

  decreaseQuantity(quantity: number): void {
    const normalizedQuantity = normalizeQuantity(quantity);

    if (normalizedQuantity > this.quantity) {
      throw new ConflictError(
        `Cannot remove ${normalizedQuantity} units of barcode ${this.barcode} because the cart only contains ${this.quantity}`
      );
    }

    this.quantity -= normalizedQuantity;
    this.lineTotal = roundMoney(this.unitPrice * this.quantity);
  }

  matchesProduct(productId: string): boolean {
    return this.productId === normalizeIdentifier(productId, 'Product id');
  }

  matchesBarcode(barcode: string): boolean {
    return this.barcode === normalizeBarcode(barcode);
  }

  isEmpty(): boolean {
    return this.quantity === 0;
  }

  toPrimitives(): SaleItemPrimitives {
    return {
      productId: this.productId,
      barcode: this.barcode,
      name: this.name,
      unitOfMeasure: this.unitOfMeasure,
      unitPrice: this.unitPrice,
      quantity: this.quantity,
      lineTotal: this.lineTotal
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

function normalizeBarcode(value: string): string {
  return normalizeRequiredString(value, 'Product barcode');
}

function normalizeUnitOfMeasure(value: string): string {
  return normalizeRequiredString(value, 'Product unit of measure').toUpperCase();
}

function normalizeQuantity(value: number): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError('Sale item quantity must be a positive integer');
  }

  return value;
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError('Sale item unit price must be greater than zero');
  }

  return roundMoney(value);
}

function normalizeLineTotal(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new DomainValidationError('Sale item line total must be greater than or equal to zero');
  }

  return roundMoney(value);
}

function roundMoney(value: number): number {
  return Number.parseFloat(value.toFixed(2));
}
