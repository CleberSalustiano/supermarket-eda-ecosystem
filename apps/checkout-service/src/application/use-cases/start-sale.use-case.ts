import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';

import type { SaleOutputDto, StartSaleInputDto } from '../dto/sale.dto';
import { toSaleOutputDto } from '../dto/sale.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import { normalizeRequiredValue } from '../support/input-normalization';
import { Sale } from '#/domain/entities/sale.entity';

@Injectable()
export class StartSaleUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort
  ) {}

  async execute(input: StartSaleInputDto): Promise<SaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const sessionId = normalizeRequiredValue(input.sessionId, 'POS session id');
    const sale = await this.transactionRunner.execute(async ({ posSessionRepository, saleRepository }) => {
      const session = await posSessionRepository.findById(tenantId, sessionId);

      if (!session) {
        throw new ResourceNotFoundError(
          `POS session ${sessionId} was not found for tenant ${tenantId}`
        );
      }

      session.assertOpen();

      const createdSale = Sale.start({
        id: randomUUID(),
        tenantId,
        sessionId
      });

      await saleRepository.save(createdSale);

      return createdSale;
    });

    return toSaleOutputDto(sale);
  }
}
