import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import type { SaleOutputDto } from '#/application/dto/sale.dto';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { ManageSaleItemRequestDto } from './dto/manage-sale-item.request.dto';
import { StartSaleRequestDto } from './dto/start-sale.request.dto';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly startSaleUseCase: StartSaleUseCase,
    private readonly addSaleItemUseCase: AddSaleItemUseCase,
    private readonly removeSaleItemUseCase: RemoveSaleItemUseCase
  ) {}

  @Post()
  async startSale(@Body() request: StartSaleRequestDto): Promise<SaleOutputDto> {
    return this.startSaleUseCase.execute({
      tenantId: request.tenantId,
      sessionId: request.sessionId
    });
  }

  @Post(':saleId/items')
  @HttpCode(HttpStatus.OK)
  async addItem(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() request: ManageSaleItemRequestDto
  ): Promise<SaleOutputDto> {
    return this.addSaleItemUseCase.execute({
      tenantId: request.tenantId,
      saleId,
      barcode: request.barcode,
      quantity: request.quantity
    });
  }

  @Post(':saleId/items/removals')
  @HttpCode(HttpStatus.OK)
  async removeItem(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() request: ManageSaleItemRequestDto
  ): Promise<SaleOutputDto> {
    return this.removeSaleItemUseCase.execute({
      tenantId: request.tenantId,
      saleId,
      barcode: request.barcode,
      quantity: request.quantity
    });
  }
}
