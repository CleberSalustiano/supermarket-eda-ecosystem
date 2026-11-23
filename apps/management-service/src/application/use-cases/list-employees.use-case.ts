import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError } from '@supermarket/shared-domain';

import { toEmployeeViewDto } from '../dto/employee-view.mapper';
import type {
  ListEmployeesInputDto,
  ListEmployeesOutputDto
} from '../dto/employee-management.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

@Injectable()
export class ListEmployeesUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(input: ListEmployeesInputDto): Promise<ListEmployeesOutputDto> {
    const status = input.status ?? 'all';
    const limit = input.limit ?? DEFAULT_LIMIT;
    const offset = input.offset ?? 0;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw new DomainValidationError(`limit must be an integer between 1 and ${MAX_LIMIT}`);
    }

    if (!Number.isInteger(offset) || offset < 0) {
      throw new DomainValidationError('offset must be an integer greater than or equal to 0');
    }

    const result = await this.transactionRunner.execute(({ employeeRepository }) =>
      employeeRepository.list(input.tenantId, { status, limit, offset })
    );

    return {
      items: result.items.map(toEmployeeViewDto),
      total: result.total,
      limit,
      offset
    };
  }
}
