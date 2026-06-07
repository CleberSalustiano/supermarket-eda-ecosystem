import { Injectable } from '@nestjs/common';

import { DataSource } from 'typeorm';

import type {
  ManagementTransactionContext,
  ManagementTransactionRunnerPort
} from '#/application/ports/management-transaction-runner.port';
import { TypeormEmployeeRepository } from './repositories/typeorm-employee.repository';
import { TypeormOutboxEventRepository } from './repositories/typeorm-outbox-event.repository';
import { TypeormProductRepository } from './repositories/typeorm-product.repository';

@Injectable()
export class TypeormManagementTransactionRunner implements ManagementTransactionRunnerPort {
  constructor(private readonly dataSource: DataSource) {}

  async execute<T>(work: (context: ManagementTransactionContext) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) =>
      work({
        employeeRepository: new TypeormEmployeeRepository(manager),
        outboxEventRepository: new TypeormOutboxEventRepository(manager),
        productRepository: new TypeormProductRepository(manager)
      })
    );
  }
}
