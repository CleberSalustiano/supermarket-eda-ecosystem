import { randomUUID } from 'crypto';

import { Inject, Injectable } from '@nestjs/common';

import { ConflictError } from '@supermarket/shared-domain';

import type {
  OpenPosSessionInputDto,
  OpenPosSessionOutputDto
} from '../dto/open-pos-session.dto';
import { toOpenPosSessionOutputDto } from '../dto/open-pos-session.dto';
import type { CheckoutTransactionRunnerPort } from '../ports/checkout-transaction-runner.port';
import { CHECKOUT_TRANSACTION_RUNNER } from '../ports/checkout-transaction-runner.port';
import { normalizeRequiredValue } from '../support/input-normalization';
import { PosSession } from '#/domain/entities/pos-session.entity';

@Injectable()
export class OpenPosSessionUseCase {
  constructor(
    @Inject(CHECKOUT_TRANSACTION_RUNNER)
    private readonly transactionRunner: CheckoutTransactionRunnerPort
  ) {}

  async execute(input: OpenPosSessionInputDto): Promise<OpenPosSessionOutputDto> {
    const tenantId = normalizeRequiredValue(input.tenantId, 'Tenant id');
    const registerId = normalizeRequiredValue(input.registerId, 'Register id');
    const operatorId = normalizeRequiredValue(input.operatorId, 'Operator id');
    const session = PosSession.open({
      id: randomUUID(),
      tenantId,
      registerId,
      operatorId,
      openingFloatAmount: input.openingFloatAmount
    });

    await this.transactionRunner.execute(async ({ posSessionRepository }) => {
      const existingSession = await posSessionRepository.findOpenByRegisterId(tenantId, registerId);

      if (existingSession) {
        throw new ConflictError(
          `Register ${registerId} already has an open POS session for tenant ${tenantId}`
        );
      }

      await posSessionRepository.save(session);
    });

    return toOpenPosSessionOutputDto(session);
  }
}
