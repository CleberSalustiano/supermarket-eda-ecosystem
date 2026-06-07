import { ConflictError, DomainValidationError } from '@supermarket/shared-domain';

export interface ProductCatalogItemPrimitives {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
  priceUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
}

interface SynchronizeProductCatalogItemInput {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
  priceUpdatedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateProductCatalogItemInput {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
  priceUpdatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ApplyPriceUpdateInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  unitPrice: number;
  active: boolean;
  priceUpdatedAt: Date;
  updatedAt?: Date;
}

export type ProductCatalogItemUpdateStatus = 'updated' | 'ignored';

export class ProductCatalogItem {
  private constructor(
    private readonly productId: string,
    private readonly tenantId: string,
    private barcode: string,
    private name: string,
    private unitOfMeasure: string,
    private unitPrice: number,
    private active: boolean,
    private priceUpdatedAt: Date,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static synchronize(input: SynchronizeProductCatalogItemInput): ProductCatalogItem {
    const now = input.createdAt ?? new Date();

    return new ProductCatalogItem(
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBarcode(input.barcode),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeUnitOfMeasure(input.unitOfMeasure),
      normalizeMoney(input.unitPrice),
      input.active,
      ensureDate(input.priceUpdatedAt, 'Price update timestamp'),
      now,
      input.updatedAt ?? now
    );
  }

  static rehydrate(input: RehydrateProductCatalogItemInput): ProductCatalogItem {
    return new ProductCatalogItem(
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBarcode(input.barcode),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeUnitOfMeasure(input.unitOfMeasure),
      normalizeMoney(input.unitPrice),
      input.active,
      ensureDate(input.priceUpdatedAt, 'Price update timestamp'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at')
    );
  }

  applyPriceUpdate(input: ApplyPriceUpdateInput): ProductCatalogItemUpdateStatus {
    const nextPriceUpdatedAt = ensureDate(input.priceUpdatedAt, 'Price update timestamp');

    if (nextPriceUpdatedAt.getTime() < this.priceUpdatedAt.getTime()) {
      return 'ignored';
    }

    const nextBarcode = normalizeBarcode(input.barcode);
    const nextName = normalizeRequiredString(input.name, 'Product name');
    const nextUnitOfMeasure = normalizeUnitOfMeasure(input.unitOfMeasure);
    const nextUnitPrice = normalizeMoney(input.unitPrice);
    const nextUpdatedAt = input.updatedAt ?? new Date();

    if (
      nextPriceUpdatedAt.getTime() === this.priceUpdatedAt.getTime() &&
      nextBarcode === this.barcode &&
      nextName === this.name &&
      nextUnitOfMeasure === this.unitOfMeasure &&
      nextUnitPrice === this.unitPrice &&
      input.active === this.active
    ) {
      return 'ignored';
    }

    this.barcode = nextBarcode;
    this.name = nextName;
    this.unitOfMeasure = nextUnitOfMeasure;
    this.unitPrice = nextUnitPrice;
    this.active = input.active;
    this.priceUpdatedAt = nextPriceUpdatedAt;
    this.updatedAt = nextUpdatedAt;

    return 'updated';
  }

  ensureAvailableForSale(): void {
    if (!this.active) {
      throw new ConflictError(
        `Product ${this.barcode} is inactive for tenant ${this.tenantId}`
      );
    }
  }

  toPrimitives(): ProductCatalogItemPrimitives {
    return {
      productId: this.productId,
      tenantId: this.tenantId,
      barcode: this.barcode,
      name: this.name,
      unitOfMeasure: this.unitOfMeasure,
      unitPrice: this.unitPrice,
      active: this.active,
      priceUpdatedAt: this.priceUpdatedAt.toISOString(),
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

function normalizeRequiredString(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}

function normalizeBarcode(value: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError('Product barcode cannot be empty');
  }

  return normalizedValue;
}

function normalizeUnitOfMeasure(value: string): string {
  return normalizeRequiredString(value, 'Product unit of measure').toUpperCase();
}

function normalizeMoney(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError('Unit price must be greater than zero');
  }

  return Number.parseFloat(value.toFixed(2));
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
