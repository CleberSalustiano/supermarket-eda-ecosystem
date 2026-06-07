import { Controller, Get, Param, Query } from '@nestjs/common';

import type { ScanProductByBarcodeOutputDto } from '../../application/dto/scan-product-by-barcode.dto';
import { ScanProductByBarcodeUseCase } from '../../application/use-cases/scan-product-by-barcode.use-case';
import { ScanProductByBarcodeQueryDto } from './dto/scan-product-by-barcode.query.dto';

@Controller('catalog-items')
export class ProductCatalogController {
  constructor(private readonly scanProductByBarcodeUseCase: ScanProductByBarcodeUseCase) {}

  @Get('barcodes/:barcode')
  async scanByBarcode(
    @Param('barcode') barcode: string,
    @Query() query: ScanProductByBarcodeQueryDto
  ): Promise<ScanProductByBarcodeOutputDto> {
    return this.scanProductByBarcodeUseCase.execute({
      tenantId: query.tenantId,
      barcode
    });
  }
}
