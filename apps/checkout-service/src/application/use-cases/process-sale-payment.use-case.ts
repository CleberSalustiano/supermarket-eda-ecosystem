import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';

import type { ProcessSalePaymentInputDto, SaleOutputDto } from '../dto/sale.dto';
import { toSaleOutputDto } from '../dto/sale.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import { normalizeRequiredValue } from '../support/input-normalization';

@Injectable()
export class ProcessSalePaymentUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort
  ) {}

  async execute(input: ProcessSalePaymentInputDto): Promise<SaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const saleId = normalizeRequiredValue(input.saleId, 'Sale id');
    const sale = await this.transactionRunner.execute(async ({ posSessionRepository, saleRepository }) => {
      const sale = await saleRepository.findById(tenantId, saleId);

      if (!sale) {
        throw new ResourceNotFoundError(`Sale ${saleId} was not found for tenant ${tenantId}`);
      }

      const saleState = sale.toPrimitives();
      const session = await posSessionRepository.findById(tenantId, saleState.sessionId);

      if (!session) {
        throw new ResourceNotFoundError(
          `POS session ${saleState.sessionId} was not found for tenant ${tenantId}`
        );
      }

      session.assertOpen();
      sale.registerPayment({
        paymentMethod: input.paymentMethod,
        paidAmount: input.paidAmount
      });
      await saleRepository.save(sale);

      return sale;
    });

    return toSaleOutputDto(sale);
  }
}
