import { DomainValidationError } from '@supermarket/shared-domain';

export interface ManagerApprovalPrimitives {
  employeeId: string;
  employeeCode: string;
  fullName: string;
}

/**
 * The manager who authorized a post-payment sale cancellation, as verified by
 * management-service. It never carries credentials.
 */
export class ManagerApproval {
  private constructor(
    private readonly employeeId: string,
    private readonly employeeCode: string,
    private readonly fullName: string
  ) {}

  static create(input: ManagerApprovalPrimitives): ManagerApproval {
    return new ManagerApproval(
      normalizeRequiredString(input.employeeId, 'Approver employee id'),
      normalizeRequiredString(input.employeeCode, 'Approver employee code'),
      normalizeRequiredString(input.fullName, 'Approver full name')
    );
  }

  toPrimitives(): ManagerApprovalPrimitives {
    return {
      employeeId: this.employeeId,
      employeeCode: this.employeeCode,
      fullName: this.fullName
    };
  }
}

function normalizeRequiredString(value: string, label: string): string {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}
