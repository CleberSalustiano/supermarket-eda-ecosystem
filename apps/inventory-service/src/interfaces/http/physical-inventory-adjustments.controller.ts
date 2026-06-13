import { Body, Controller, Post } from '@nestjs/common';

import type { RegisterPhysicalInventoryAdjustmentOutputDto } from '#/application/dto/register-physical-inventory-adjustment.dto';
import { RegisterPhysicalInventoryAdjustmentUseCase } from '#/application/use-cases/register-physical-inventory-adjustment.use-case';
import { RegisterPhysicalInventoryAdjustmentRequestDto } from './dto/register-physical-inventory-adjustment.request.dto';

@Controller('inventory-adjustments/physical')
export class PhysicalInventoryAdjustmentsController {
  constructor(
    private readonly registerPhysicalInventoryAdjustmentUseCase: RegisterPhysicalInventoryAdjustmentUseCase
  ) {}

  @Post()
  async register(
    @Body() request: RegisterPhysicalInventoryAdjustmentRequestDto
  ): Promise<RegisterPhysicalInventoryAdjustmentOutputDto> {
    return this.registerPhysicalInventoryAdjustmentUseCase.execute({
      tenantId: request.tenantId,
      productId: request.productId,
      barcode: request.barcode,
      name: request.name,
      unitOfMeasure: request.unitOfMeasure,
      countedQuantity: request.countedQuantity,
      minimumThreshold: request.minimumThreshold,
      reason: request.reason,
      collectorId: request.collectorId,
      occurredAt: request.occurredAt
    });
  }
}
