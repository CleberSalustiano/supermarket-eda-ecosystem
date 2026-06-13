import { DomainValidationError } from '@supermarket/shared-domain';

export interface SupplierInvoiceLinePrimitives {
  id: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
}

export interface SupplierInvoicePrimitives {
  id: string;
  tenantId: string;
  supplierReference: string;
  totalItemsQuantity: number;
  totalCost: number;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  items: SupplierInvoiceLinePrimitives[];
}

interface RegisterSupplierInvoiceLineInput {
  id: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
}

interface RegisterSupplierInvoiceInput {
  id: string;
  tenantId: string;
  supplierReference: string;
  receivedAt: Date;
  items: RegisterSupplierInvoiceLineInput[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateSupplierInvoiceLineInput {
  id: string;
  productId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  lineCost: number;
}

interface RehydrateSupplierInvoiceInput {
  id: string;
  tenantId: string;
  supplierReference: string;
  totalItemsQuantity: number;
  totalCost: number;
  receivedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  items: RehydrateSupplierInvoiceLineInput[];
}

class SupplierInvoiceLine {
  private constructor(
    private readonly id: string,
    private readonly productId: string,
    private readonly barcode: string,
    private readonly name: string,
    private readonly unitOfMeasure: string,
    private readonly quantity: number,
    private readonly unitCost: number,
    private readonly lineCost: number
  ) {}

  static register(input: RegisterSupplierInvoiceLineInput): SupplierInvoiceLine {
    const quantity = normalizePositiveInteger(input.quantity, 'Received quantity');
    const unitCost = normalizeMoney(input.unitCost, 'Received unit cost');

    return new SupplierInvoiceLine(
      normalizeIdentifier(input.id, 'Supplier invoice line id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeRequiredString(input.barcode, 'Product barcode'),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeRequiredString(input.unitOfMeasure, 'Product unit of measure').toUpperCase(),
      quantity,
      unitCost,
      Number.parseFloat((quantity * unitCost).toFixed(2))
    );
  }

  static rehydrate(input: RehydrateSupplierInvoiceLineInput): SupplierInvoiceLine {
    return new SupplierInvoiceLine(
      normalizeIdentifier(input.id, 'Supplier invoice line id'),
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeRequiredString(input.barcode, 'Product barcode'),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeRequiredString(input.unitOfMeasure, 'Product unit of measure').toUpperCase(),
      normalizePositiveInteger(input.quantity, 'Received quantity'),
      normalizeMoney(input.unitCost, 'Received unit cost'),
      normalizeMoney(input.lineCost, 'Invoice line cost')
    );
  }

  quantityValue(): number {
    return this.quantity;
  }

  lineCostValue(): number {
    return this.lineCost;
  }

  productIdValue(): string {
    return this.productId;
  }

  toPrimitives(): SupplierInvoiceLinePrimitives {
    return {
      id: this.id,
      productId: this.productId,
      barcode: this.barcode,
      name: this.name,
      unitOfMeasure: this.unitOfMeasure,
      quantity: this.quantity,
      unitCost: this.unitCost,
      lineCost: this.lineCost
    };
  }
}

export class SupplierInvoice {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly supplierReference: string,
    private readonly totalItemsQuantity: number,
    private readonly totalCost: number,
    private readonly receivedAt: Date,
    private readonly createdAt: Date,
    private readonly updatedAt: Date,
    private readonly items: SupplierInvoiceLine[]
  ) {}

  static register(input: RegisterSupplierInvoiceInput): SupplierInvoice {
    const items = normalizeInvoiceItems(input.items);
    const now = input.createdAt ?? new Date();

    return new SupplierInvoice(
      normalizeIdentifier(input.id, 'Supplier invoice id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeSupplierReference(input.supplierReference),
      items.reduce((total, item) => total + item.quantityValue(), 0),
      Number.parseFloat(items.reduce((total, item) => total + item.lineCostValue(), 0).toFixed(2)),
      ensureDate(input.receivedAt, 'Received at'),
      ensureDate(now, 'Created at'),
      ensureDate(input.updatedAt ?? now, 'Updated at'),
      items
    );
  }

  static rehydrate(input: RehydrateSupplierInvoiceInput): SupplierInvoice {
    const items = normalizeRehydratedInvoiceItems(input.items);

    return new SupplierInvoice(
      normalizeIdentifier(input.id, 'Supplier invoice id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeSupplierReference(input.supplierReference),
      normalizePositiveInteger(input.totalItemsQuantity, 'Total items quantity'),
      normalizeMoney(input.totalCost, 'Invoice total cost'),
      ensureDate(input.receivedAt, 'Received at'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at'),
      items
    );
  }

  referencesSupplierInvoice(tenantId: string, supplierReference: string): boolean {
    return (
      this.tenantId === tenantId &&
      this.supplierReference === normalizeSupplierReference(supplierReference)
    );
  }

  toPrimitives(): SupplierInvoicePrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      supplierReference: this.supplierReference,
      totalItemsQuantity: this.totalItemsQuantity,
      totalCost: this.totalCost,
      receivedAt: this.receivedAt.toISOString(),
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      items: this.items.map((item) => item.toPrimitives())
    };
  }
}

function normalizeInvoiceItems(
  items: RegisterSupplierInvoiceLineInput[]
): SupplierInvoiceLine[] {
  if (items.length === 0) {
    throw new DomainValidationError('Supplier invoice must contain at least one item');
  }

  const registeredItems = items.map((item) => SupplierInvoiceLine.register(item));

  assertUniqueProductIds(registeredItems);

  return registeredItems;
}

function normalizeRehydratedInvoiceItems(
  items: RehydrateSupplierInvoiceLineInput[]
): SupplierInvoiceLine[] {
  if (items.length === 0) {
    throw new DomainValidationError('Supplier invoice must contain at least one item');
  }

  const rehydratedItems = items.map((item) => SupplierInvoiceLine.rehydrate(item));

  assertUniqueProductIds(rehydratedItems);

  return rehydratedItems;
}

function assertUniqueProductIds(items: SupplierInvoiceLine[]): void {
  const seenProductIds = new Set<string>();

  for (const item of items) {
    const productId = item.productIdValue();

    if (seenProductIds.has(productId)) {
      throw new DomainValidationError(
        `Supplier invoice contains duplicated product ${productId}`
      );
    }

    seenProductIds.add(productId);
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

function normalizeSupplierReference(value: string): string {
  return normalizeRequiredString(value, 'Supplier reference').toUpperCase();
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }

  return value;
}

function normalizeMoney(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be greater than zero`);
  }

  return Number.parseFloat(value.toFixed(2));
}

function ensureDate(value: Date, label: string): Date {
  if (Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${label} is invalid`);
  }

  return value;
}
