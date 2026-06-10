import { Injectable } from '@nestjs/common';

import type { EventEnvelope, SaleCanceledEventPayload } from '@supermarket/shared-domain';

import type { RevertSaleIssueOutputDto } from '#/application/dto/revert-sale-issue.dto';
import { RevertSaleIssueUseCase } from '#/application/use-cases/revert-sale-issue.use-case';

@Injectable()
export class SaleCanceledConsumer {
  constructor(private readonly revertSaleIssueUseCase: RevertSaleIssueUseCase) {}

  async handle(event: EventEnvelope<SaleCanceledEventPayload>): Promise<RevertSaleIssueOutputDto> {
    return this.revertSaleIssueUseCase.execute({ event });
  }
}
