import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';

import { toEmployeeViewDto } from '../dto/employee-view.mapper';
import type {
  DeactivateEmployeeInputDto,
  EmployeeViewDto
} from '../dto/employee-management.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';
import { EmployeeAuditEntry } from '#/domain/entities/employee-audit-entry.entity';

@Injectable()
export class DeactivateEmployeeUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(input: DeactivateEmployeeInputDto): Promise<EmployeeViewDto> {
    return this.transactionRunner.execute(
      async ({ employeeAuditEntryRepository, employeeRepository }) => {
        const employee = await employeeRepository.findById(input.tenantId, input.employeeId);

        if (!employee) {
          throw new ResourceNotFoundError(`Employee ${input.employeeId} was not found`);
        }

        const now = new Date();

        employee.deactivate(now);

        const state = employee.toPrimitives();

        await employeeRepository.save(employee);
        await employeeAuditEntryRepository.append(
          EmployeeAuditEntry.record({
            id: randomUUID(),
            tenantId: state.tenantId,
            employeeId: state.id,
            employeeCode: state.employeeCode,
            action: 'DEACTIVATED',
            occurredAt: now
          })
        );

        return toEmployeeViewDto(employee);
      }
    );
  }
}
