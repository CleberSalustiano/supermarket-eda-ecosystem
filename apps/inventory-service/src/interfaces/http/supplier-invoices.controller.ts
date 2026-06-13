import { Body, Controller, Post } from '@nestjs/common';

import type { RegisterSupplierInvoiceOutputDto } from '#/application/dto/register-supplier-invoice.dto';
import { RegisterSupplierInvoiceUseCase } from '#/application/use-cases/register-supplier-invoice.use-case';
import { RegisterSupplierInvoiceRequestDto } from './dto/register-supplier-invoice.request.dto';

@Controller('supplier-invoices')
export class SupplierInvoicesController {
  constructor(
    private readonly registerSupplierInvoiceUseCase: RegisterSupplierInvoiceUseCase
  ) {}

  @Post()
  async register(
    @Body() request: RegisterSupplierInvoiceRequestDto
  ): Promise<RegisterSupplierInvoiceOutputDto> {
    return this.registerSupplierInvoiceUseCase.execute({
      tenantId: request.tenantId,
      supplierReference: request.supplierReference,
      receivedAt: request.receivedAt,
      items: request.items.map((item) => ({
        productId: item.productId,
        barcode: item.barcode,
        name: item.name,
        unitOfMeasure: item.unitOfMeasure,
        quantity: item.quantity,
        unitCost: item.unitCost
      }))
    });
  }
}
