import { DomainValidationError, EmployeeRole } from '@supermarket/shared-domain';

export interface EmployeePrimitives {
  id: string;
  tenantId: string;
  employeeCode: string;
  fullName: string;
  role: EmployeeRole;
  pinHash: string;
  active: boolean;
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
    private readonly pinHash: string,
    private active: boolean,
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
      input.createdAt,
      input.updatedAt
    );
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
