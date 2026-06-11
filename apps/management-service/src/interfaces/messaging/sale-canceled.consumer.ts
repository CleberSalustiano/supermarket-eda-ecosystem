import { Injectable } from '@nestjs/common';

import type { EventEnvelope, SaleCanceledEventPayload } from '@supermarket/shared-domain';

import type { CompensateCanceledSaleOutputDto } from '#/application/dto/compensate-canceled-sale.dto';
import { CompensateCanceledSaleUseCase } from '#/application/use-cases/compensate-canceled-sale.use-case';

@Injectable()
export class SaleCanceledConsumer {
  constructor(
    private readonly compensateCanceledSaleUseCase: CompensateCanceledSaleUseCase
  ) {}

  async handle(
    event: EventEnvelope<SaleCanceledEventPayload>
  ): Promise<CompensateCanceledSaleOutputDto> {
    return this.compensateCanceledSaleUseCase.execute({ event });
  }
}
