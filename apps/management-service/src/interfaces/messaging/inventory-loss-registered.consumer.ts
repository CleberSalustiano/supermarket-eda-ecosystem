import { Injectable } from '@nestjs/common';

import type {
  EventEnvelope,
  InventoryLossRegisteredEventPayload
} from '@supermarket/shared-domain';

import type { CaptureInventoryLossOutputDto } from '#/application/dto/capture-inventory-loss.dto';
import { CaptureInventoryLossUseCase } from '#/application/use-cases/capture-inventory-loss.use-case';

@Injectable()
export class InventoryLossRegisteredConsumer {
  constructor(private readonly captureInventoryLossUseCase: CaptureInventoryLossUseCase) {}

  async handle(
    event: EventEnvelope<InventoryLossRegisteredEventPayload>
  ): Promise<CaptureInventoryLossOutputDto> {
    return this.captureInventoryLossUseCase.execute({ event });
  }
}
