import { DomainValidationError } from '@supermarket/shared-domain';

export interface InventoryItemPrimitives {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  onHandQuantity: number;
  minimumThreshold: number;
  averageUnitCost: number | null;
  lastLowStockAlertAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface InitializeInventoryItemInput {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  onHandQuantity?: number;
  minimumThreshold?: number;
  averageUnitCost?: number | null;
  lastLowStockAlertAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateInventoryItemInput {
  productId: string;
  tenantId: string;
  barcode: string;
  name: string;
  unitOfMeasure: string;
  onHandQuantity: number;
  minimumThreshold: number;
  averageUnitCost: number | null;
  lastLowStockAlertAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IssueSaleInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  updatedAt?: Date;
}

interface RevertSaleIssueInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  updatedAt?: Date;
}

interface RegisterLossInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  updatedAt?: Date;
}

interface ReceiveStockInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  quantity: number;
  unitCost: number;
  updatedAt?: Date;
}

interface ApplyPhysicalCountInput {
  barcode: string;
  name: string;
  unitOfMeasure: string;
  countedQuantity: number;
  minimumThreshold?: number;
  updatedAt?: Date;
}

export class InventoryItem {
  private constructor(
    private readonly productId: string,
    private readonly tenantId: string,
    private barcode: string,
    private name: string,
    private unitOfMeasure: string,
    private onHandQuantity: number,
    private minimumThreshold: number,
    private averageUnitCost: number | null,
    private lastLowStockAlertAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static initialize(input: InitializeInventoryItemInput): InventoryItem {
    const now = input.createdAt ?? new Date();

    return new InventoryItem(
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBarcode(input.barcode),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeUnitOfMeasure(input.unitOfMeasure),
      normalizeWholeNumber(input.onHandQuantity ?? 0, 'On-hand quantity'),
      normalizeWholeNumber(input.minimumThreshold ?? 0, 'Minimum threshold'),
      normalizeOptionalMoney(input.averageUnitCost),
      normalizeOptionalDate(input.lastLowStockAlertAt, 'Last low stock alert at'),
      ensureDate(input.createdAt ?? now, 'Created at'),
      ensureDate(input.updatedAt ?? now, 'Updated at')
    );
  }

  static rehydrate(input: RehydrateInventoryItemInput): InventoryItem {
    return new InventoryItem(
      normalizeIdentifier(input.productId, 'Product id'),
      normalizeIdentifier(input.tenantId, 'Tenant id'),
      normalizeBarcode(input.barcode),
      normalizeRequiredString(input.name, 'Product name'),
      normalizeUnitOfMeasure(input.unitOfMeasure),
      normalizeInteger(input.onHandQuantity, 'On-hand quantity'),
      normalizeWholeNumber(input.minimumThreshold, 'Minimum threshold'),
      normalizeOptionalMoney(input.averageUnitCost),
      normalizeOptionalDate(input.lastLowStockAlertAt, 'Last low stock alert at'),
      ensureDate(input.createdAt, 'Created at'),
      ensureDate(input.updatedAt, 'Updated at')
    );
  }

  receiveStock(input: ReceiveStockInput): void {
    const quantity = normalizePositiveInteger(input.quantity, 'Received quantity');
    const unitCost = normalizeMoney(input.unitCost, 'Received unit cost');
    const nextOnHandQuantity = this.onHandQuantity + quantity;

    this.synchronizeProductData(input.barcode, input.name, input.unitOfMeasure);

    if (this.averageUnitCost === null || this.onHandQuantity <= 0) {
      this.averageUnitCost = unitCost;
    } else {
      const weightedAverageCost =
        (this.onHandQuantity * this.averageUnitCost + quantity * unitCost) / nextOnHandQuantity;

      this.averageUnitCost = Number.parseFloat(weightedAverageCost.toFixed(2));
    }

    this.onHandQuantity = nextOnHandQuantity;
    this.updatedAt = ensureDate(input.updatedAt ?? new Date(), 'Updated at');
    this.refreshLowStockAlertState();
  }

  issueSale(input: IssueSaleInput): void {
    const quantity = normalizePositiveInteger(input.quantity, 'Sale issue quantity');

    this.synchronizeProductData(input.barcode, input.name, input.unitOfMeasure);
    this.onHandQuantity -= quantity;
    this.updatedAt = ensureDate(input.updatedAt ?? new Date(), 'Updated at');
    this.refreshLowStockAlertState();
  }

  revertSaleIssue(input: RevertSaleIssueInput): void {
    const quantity = normalizePositiveInteger(input.quantity, 'Sale issue reversion quantity');

    this.synchronizeProductData(input.barcode, input.name, input.unitOfMeasure);
    this.onHandQuantity += quantity;
    this.updatedAt = ensureDate(input.updatedAt ?? new Date(), 'Updated at');
    this.refreshLowStockAlertState();
  }

  registerLoss(input: RegisterLossInput): void {
    const quantity = normalizePositiveInteger(input.quantity, 'Inventory loss quantity');

    this.synchronizeProductData(input.barcode, input.name, input.unitOfMeasure);
    this.onHandQuantity -= quantity;
    this.updatedAt = ensureDate(input.updatedAt ?? new Date(), 'Updated at');
    this.refreshLowStockAlertState();
  }

  applyPhysicalCount(input: ApplyPhysicalCountInput): number {
    const countedQuantity = normalizeWholeNumber(input.countedQuantity, 'Counted quantity');
    const quantityDelta = countedQuantity - this.onHandQuantity;

    this.synchronizeProductData(input.barcode, input.name, input.unitOfMeasure);

    if (input.minimumThreshold !== undefined) {
      this.minimumThreshold = normalizeWholeNumber(input.minimumThreshold, 'Minimum threshold');
    }

    this.onHandQuantity = countedQuantity;
    this.updatedAt = ensureDate(input.updatedAt ?? new Date(), 'Updated at');
    this.refreshLowStockAlertState();

    return quantityDelta;
  }

  shouldEmitLowStockAlert(cooldownCutoff: Date): boolean {
    const normalizedCutoff = ensureDate(cooldownCutoff, 'Low stock alert cooldown cutoff');

    return (
      this.isBelowMinimumThreshold() &&
      (this.lastLowStockAlertAt === null ||
        this.lastLowStockAlertAt.getTime() <= normalizedCutoff.getTime())
    );
  }

  markLowStockAlertEmitted(emittedAt: Date): void {
    if (!this.isBelowMinimumThreshold()) {
      throw new DomainValidationError('Cannot mark a low stock alert for an item above threshold');
    }

    this.lastLowStockAlertAt = ensureDate(emittedAt, 'Low stock alert emitted at');
    this.updatedAt = ensureDate(emittedAt, 'Updated at');
  }

  toPrimitives(): InventoryItemPrimitives {
    return {
      productId: this.productId,
      tenantId: this.tenantId,
      barcode: this.barcode,
      name: this.name,
      unitOfMeasure: this.unitOfMeasure,
      onHandQuantity: this.onHandQuantity,
      minimumThreshold: this.minimumThreshold,
      averageUnitCost: this.averageUnitCost,
      lastLowStockAlertAt: this.lastLowStockAlertAt?.toISOString() ?? null,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  private synchronizeProductData(barcode: string, name: string, unitOfMeasure: string): void {
    this.barcode = normalizeBarcode(barcode);
    this.name = normalizeRequiredString(name, 'Product name');
    this.unitOfMeasure = normalizeUnitOfMeasure(unitOfMeasure);
  }

  private isBelowMinimumThreshold(): boolean {
    return this.minimumThreshold > 0 && this.onHandQuantity <= this.minimumThreshold;
  }

  private refreshLowStockAlertState(): void {
    if (!this.isBelowMinimumThreshold()) {
      this.lastLowStockAlertAt = null;
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

function normalizeBarcode(value: string): string {
  return normalizeRequiredString(value, 'Product barcode');
}

function normalizeUnitOfMeasure(value: string): string {
  return normalizeRequiredString(value, 'Product unit of measure').toUpperCase();
}

function normalizeWholeNumber(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainValidationError(`${label} must be greater than or equal to zero`);
  }

  return value;
}

function normalizeInteger(value: number, label: string): number {
  if (!Number.isInteger(value)) {
    throw new DomainValidationError(`${label} must be an integer`);
  }

  return value;
}

function normalizePositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new DomainValidationError(`${label} must be a positive integer`);
  }

  return value;
}

function normalizeOptionalMoney(value: number | null | undefined): number | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeMoney(value, 'Average unit cost');
}

function normalizeOptionalDate(value: Date | null | undefined, label: string): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  return ensureDate(value, label);
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
