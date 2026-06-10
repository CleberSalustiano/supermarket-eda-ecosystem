import { Injectable } from '@nestjs/common';

import type {
  EventEnvelope,
  SaleCompletedEventPayload
} from '@supermarket/shared-domain';

import type { ConsolidateCompletedSaleOutputDto } from '#/application/dto/consolidate-completed-sale.dto';
import { ConsolidateCompletedSaleUseCase } from '#/application/use-cases/consolidate-completed-sale.use-case';

@Injectable()
export class SaleCompletedConsumer {
  constructor(
    private readonly consolidateCompletedSaleUseCase: ConsolidateCompletedSaleUseCase
  ) {}

  async handle(
    event: EventEnvelope<SaleCompletedEventPayload>
  ): Promise<ConsolidateCompletedSaleOutputDto> {
    return this.consolidateCompletedSaleUseCase.execute({ event });
  }
}
