import { Inject, Injectable } from '@nestjs/common';

import { ResourceNotFoundError } from '@supermarket/shared-domain';

import type { RemoveSaleItemInputDto, SaleOutputDto } from '../dto/sale.dto';
import { toSaleOutputDto } from '../dto/sale.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import { normalizePositiveInteger, normalizeRequiredValue } from '../support/input-normalization';

@Injectable()
export class RemoveSaleItemUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort
  ) {}

  async execute(input: RemoveSaleItemInputDto): Promise<SaleOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const saleId = normalizeRequiredValue(input.saleId, 'Sale id');
    const barcode = normalizeRequiredValue(input.barcode, 'Barcode');
    const quantity = normalizePositiveInteger(input.quantity, 'Quantity');
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
      sale.removeItem(barcode, quantity);
      await saleRepository.save(sale);

      return sale;
    });

    return toSaleOutputDto(sale);
  }
}
