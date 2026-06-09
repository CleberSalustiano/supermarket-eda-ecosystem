import { Injectable } from '@nestjs/common';

import type { EventEnvelope, SaleCompletedEventPayload } from '@supermarket/shared-domain';

import type { ProcessSaleIssueOutputDto } from '#/application/dto/process-sale-issue.dto';
import { ProcessSaleIssueUseCase } from '#/application/use-cases/process-sale-issue.use-case';

@Injectable()
export class SaleCompletedConsumer {
  constructor(private readonly processSaleIssueUseCase: ProcessSaleIssueUseCase) {}

  async handle(
    event: EventEnvelope<SaleCompletedEventPayload>
  ): Promise<ProcessSaleIssueOutputDto> {
    return this.processSaleIssueUseCase.execute({ event });
  }
}
