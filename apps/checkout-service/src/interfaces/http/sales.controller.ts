import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import type {
  CancelSaleOutputDto,
  CompleteSaleOutputDto,
  SaleOutputDto
} from '#/application/dto/sale.dto';
import { AddSaleItemUseCase } from '#/application/use-cases/add-sale-item.use-case';
import { CancelSaleUseCase } from '#/application/use-cases/cancel-sale.use-case';
import { CompleteSaleUseCase } from '#/application/use-cases/complete-sale.use-case';
import { ProcessSalePaymentUseCase } from '#/application/use-cases/process-sale-payment.use-case';
import { RemoveSaleItemUseCase } from '#/application/use-cases/remove-sale-item.use-case';
import { StartSaleUseCase } from '#/application/use-cases/start-sale.use-case';
import { CancelSaleRequestDto } from './dto/cancel-sale.request.dto';
import { ManageSaleItemRequestDto } from './dto/manage-sale-item.request.dto';
import { CompleteSaleRequestDto } from './dto/complete-sale.request.dto';
import { ProcessSalePaymentRequestDto } from './dto/process-sale-payment.request.dto';
import { StartSaleRequestDto } from './dto/start-sale.request.dto';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly startSaleUseCase: StartSaleUseCase,
    private readonly addSaleItemUseCase: AddSaleItemUseCase,
    private readonly removeSaleItemUseCase: RemoveSaleItemUseCase,
    private readonly processSalePaymentUseCase: ProcessSalePaymentUseCase,
    private readonly completeSaleUseCase: CompleteSaleUseCase,
    private readonly cancelSaleUseCase: CancelSaleUseCase
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

  @Post(':saleId/payment')
  @HttpCode(HttpStatus.OK)
  async processPayment(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() request: ProcessSalePaymentRequestDto
  ): Promise<SaleOutputDto> {
    return this.processSalePaymentUseCase.execute({
      tenantId: request.tenantId,
      saleId,
      paymentMethod: request.paymentMethod,
      paidAmount: request.paidAmount
    });
  }

  @Post(':saleId/completion')
  @HttpCode(HttpStatus.OK)
  async completeSale(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() request: CompleteSaleRequestDto
  ): Promise<CompleteSaleOutputDto> {
    return this.completeSaleUseCase.execute({
      tenantId: request.tenantId,
      saleId
    });
  }

  @Post(':saleId/cancellation')
  @HttpCode(HttpStatus.OK)
  async cancelSale(
    @Param('saleId', new ParseUUIDPipe({ version: '4' })) saleId: string,
    @Body() request: CancelSaleRequestDto
  ): Promise<CancelSaleOutputDto> {
    return this.cancelSaleUseCase.execute({
      tenantId: request.tenantId,
      saleId,
      reason: request.reason,
      managerApprovalCode: request.managerApprovalCode
    });
  }
}
