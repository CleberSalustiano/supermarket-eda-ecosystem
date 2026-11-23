import { ConflictError, DomainValidationError, EmployeeRole } from '@supermarket/shared-domain';

/** Roles allowed to approve a post-payment sale cancellation (D2). */
export const SALE_CANCELLATION_APPROVER_ROLES: readonly EmployeeRole[] = [
  EmployeeRole.Manager,
  EmployeeRole.Admin
];

export interface EmployeePrimitives {
  id: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  pinHash: string;
  active: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RegisterEmployeeInput {
  id: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  pinHash: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RehydrateEmployeeInput {
  id: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  pinHash: string;
  active: boolean;
  deactivatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export class Employee {
  private constructor(
    private readonly id: string,
    private readonly tenantId: string,
    private readonly employeeCode: string,
    private fullName: string,
    private readonly role: EmployeeRole,
    private pinHash: string,
    private active: boolean,
    private deactivatedAt: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  static assertRawPinMeetsPolicy(rawPin: string): void {
    if (!/^\d{4,12}$/.test(rawPin)) {
      throw new DomainValidationError('PIN must contain between 4 and 12 digits');
    }
  }

  static register(input: RegisterEmployeeInput): Employee {
    const now = input.createdAt ?? new Date();

    validateIdentifier(input.id, 'Employee id');
    validateIdentifier(input.tenantId, 'Tenant id');
    validateRequiredString(input.employeeCode, 'Employee code');
    validateRequiredString(input.fullName, 'Employee full name');
    validateRequiredString(input.pinHash, 'Employee PIN hash');

    return new Employee(
      input.id,
      input.tenantId,
      input.employeeCode.trim().toUpperCase(),
      input.fullName.trim(),
      input.role,
      input.pinHash,
      true,
      null,
      now,
      input.updatedAt ?? now
    );
  }

  static rehydrate(input: RehydrateEmployeeInput): Employee {
    validateIdentifier(input.id, 'Employee id');
    validateIdentifier(input.tenantId, 'Tenant id');
    validateRequiredString(input.employeeCode, 'Employee code');
    validateRequiredString(input.fullName, 'Employee full name');
    validateRequiredString(input.pinHash, 'Employee PIN hash');

    return new Employee(
      input.id,
      input.tenantId,
      input.employeeCode.trim().toUpperCase(),
      input.fullName.trim(),
      input.role,
      input.pinHash,
      input.active,
      input.deactivatedAt,
      input.createdAt,
      input.updatedAt
    );
  }

  isActive(): boolean {
    return this.active;
  }

  canApproveSaleCancellation(): boolean {
    return this.active && SALE_CANCELLATION_APPROVER_ROLES.includes(this.role);
  }

  deactivate(at: Date): void {
    if (!this.active) {
      throw new ConflictError(`Employee ${this.employeeCode} is already inactive`);
    }

    this.active = false;
    this.deactivatedAt = at;
    this.updatedAt = at;
  }

  assertActive(): void {
    if (!this.active) {
      throw new ConflictError(`Employee ${this.employeeCode} is inactive`);
    }
  }

  changePin(newPinHash: string, at: Date): void {
    this.assertActive();

    validateRequiredString(newPinHash, 'Employee PIN hash');

    this.pinHash = newPinHash;
    this.updatedAt = at;
  }

  toPrimitives(): EmployeePrimitives {
    return {
      id: this.id,
      tenantId: this.tenantId,
      employeeCode: this.employeeCode,
      fullName: this.fullName,
      role: this.role,
      pinHash: this.pinHash,
      active: this.active,
      deactivatedAt: this.deactivatedAt?.toISOString() ?? null,
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
