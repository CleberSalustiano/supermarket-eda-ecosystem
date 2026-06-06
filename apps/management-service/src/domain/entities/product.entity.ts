import { DomainValidationError } from '@supermarket/shared-domain';

export interface ProductPrimitives {
  id: string;
  tenantId: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  currentPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RegisterProductInput {
  id: string;
  tenantId: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  currentPrice: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateProductInput {
  id: string;
  tenantId: string;
  name: string;
  barcode: string;
  unitOfMeasure: string;
  currentPrice: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class Product {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private name: string,
    private readonly barcode: string,
    private readonly unitOfMeasure: string,
    private currentPrice: number,
    private active: boolean,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static register(input: RegisterProductInput): Product {
    const now = input.createdAt ?? new Date();

    validateIdentifier(input.id, 'Product id');
    validateIdentifier(input.tenantId, 'Tenant id');
    validateRequiredString(input.name, 'Product name');
    validateRequiredString(input.barcode, 'Product barcode');
    validateRequiredString(input.unitOfMeasure, 'Product unit of measure');

    return new Product(
      input.id,
      input.tenantId,
      input.name.trim(),
      input.barcode.trim(),
      input.unitOfMeasure.trim().toUpperCase(),
      normalizeMoney(input.currentPrice),
      true,
      now,
      input.updatedAt ?? now
    );
  }

  static rehydrate(input: RehydrateProductInput): Product {
    validateIdentifier(input.id, 'Product id');
    validateIdentifier(input.tenantId, 'Tenant id');
    validateRequiredString(input.name, 'Product name');
    validateRequiredString(input.barcode, 'Product barcode');
    validateRequiredString(input.unitOfMeasure, 'Product unit of measure');

    return new Product(
      input.id,
      input.tenantId,
      input.name.trim(),
      input.barcode.trim(),
      input.unitOfMeasure.trim().toUpperCase(),
      normalizeMoney(input.currentPrice),
      input.active,
      input.createdAt,
      input.updatedAt
    );
  }

  updatePrice(newPrice: number, updatedAt: Date = new Date()): number {
    const normalizedPrice = normalizeMoney(newPrice);

    if (normalizedPrice === this.currentPrice) {
      throw new DomainValidationError('New price must differ from the current price');
    }

    const previousPrice = this.currentPrice;

    this.currentPrice = normalizedPrice;
    this.updatedAt = updatedAt;

    return previousPrice;
  }

  toPrimitives(): ProductPrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      name: this.name,
      barcode: this.barcode,
      unitOfMeasure: this.unitOfMeasure,
      currentPrice: this.currentPrice,
      active: this.active,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}

function validateIdentifier(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }
}

function validateRequiredString(value: string, label: string): void {
  if (value.trim().length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError('Price must be greater than zero');
  }

  return Number.parseFloat(value.toFixed(2));
}
