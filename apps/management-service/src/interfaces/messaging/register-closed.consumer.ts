import { Injectable } from '@nestjs/common';

import type { EventEnvelope, RegisterClosedEventPayload } from '@supermarket/shared-domain';

import type { ReconcileRegisterClosureOutputDto } from '#/application/dto/reconcile-register-closure.dto';
import { ReconcileRegisterClosureUseCase } from '#/application/use-cases/reconcile-register-closure.use-case';

@Injectable()
export class RegisterClosedConsumer {
  constructor(
    private readonly reconcileRegisterClosureUseCase: ReconcileRegisterClosureUseCase
  ) {}

  async handle(
    event: EventEnvelope<RegisterClosedEventPayload>
  ): Promise<ReconcileRegisterClosureOutputDto> {
    return this.reconcileRegisterClosureUseCase.execute({ event });
  }
}
