import { Body, Controller, Post } from '@nestjs/common';

import type { RegisterInventoryLossOutputDto } from '#/application/dto/register-inventory-loss.dto';
import { RegisterInventoryLossUseCase } from '#/application/use-cases/register-inventory-loss.use-case';
import { RegisterInventoryLossRequestDto } from './dto/register-inventory-loss.request.dto';

@Controller('inventory-losses')
export class InventoryLossesController {
  constructor(private readonly registerInventoryLossUseCase: RegisterInventoryLossUseCase) {}

  @Post()
  async register(
    @Body() request: RegisterInventoryLossRequestDto
  ): Promise<RegisterInventoryLossOutputDto> {
    return this.registerInventoryLossUseCase.execute({
      tenantId: request.tenantId,
      productId: request.productId,
      barcode: request.barcode,
      name: request.name,
      unitOfMeasure: request.unitOfMeasure,
      quantity: request.quantity,
      reasonCode: request.reasonCode,
      notes: request.notes,
      occurredAt: request.occurredAt
    });
  }
}
