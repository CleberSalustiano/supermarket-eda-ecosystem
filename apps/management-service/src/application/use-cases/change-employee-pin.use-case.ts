import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError, ResourceNotFoundError } from '@supermarket/shared-domain';

import type {
  ChangeEmployeePinInputDto,
  ChangeEmployeePinOutputDto
} from '../dto/employee-management.dto';
import type { CredentialHasherPort } from '../ports/credential-hasher.port';
import { CREDENTIAL_HASHER } from '../ports/credential-hasher.port';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { EmployeeAuditEntry } from '#/domain/entities/employee-audit-entry.entity';
import { Employee } from '#/domain/entities/employee.entity';

@Injectable()
export class ChangeEmployeePinUseCase {
  constructor(
    @Inject(CREDENTIAL_HASHER)
    private readonly credentialHasher: CredentialHasherPort,
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(input: ChangeEmployeePinInputDto): Promise<ChangeEmployeePinOutputDto> {
    Employee.assertRawPinMeetsPolicy(input.pin);

    return this.transactionRunner.execute(
      async ({ approvalThrottleRepository, employeeAuditEntryRepository, employeeRepository }) => {
        const employee = await employeeRepository.findById(input.tenantId, input.employeeId);

        if (!employee) {
          throw new ResourceNotFoundError(`Employee ${input.employeeId} was not found`);
        }

        employee.assertActive();

        const now = new Date();
        const currentState = employee.toPrimitives();

        if (await this.credentialHasher.verify(input.pin, currentState.pinHash)) {
          throw new DomainValidationError('New PIN must differ from the current PIN');
        }

        employee.changePin(await this.credentialHasher.hash(input.pin), now);

        const state = employee.toPrimitives();

        await employeeRepository.save(employee);
        await employeeAuditEntryRepository.append(
          EmployeeAuditEntry.record({
            id: randomUUID(),
            tenantId: state.tenantId,
            employeeId: state.id,
            employeeCode: state.employeeCode,
            action: 'PIN_CHANGED',
            occurredAt: now
          })
        );
        // A new PIN lifts this employee's approver-code lockout (D3). The
        // per-register lockout is left untouched.
        await approvalThrottleRepository.clear(
          state.tenantId,
          'APPROVER_CODE',
          state.employeeCode
        );

        return {
          employeeId: state.id,
          tenantId: state.tenantId,
          employeeCode: state.employeeCode,
          pinChangedAt: now.toISOString()
        };
      }
    );
  }
}
