import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';

import type { RegisterProductOutputDto } from '#/application/dto/register-product.dto';
import type { UpdateProductPriceOutputDto } from '#/application/dto/update-product-price.dto';
import { RegisterProductUseCase } from '#/application/use-cases/register-product.use-case';
import { UpdateProductPriceUseCase } from '#/application/use-cases/update-product-price.use-case';
import { RegisterProductRequestDto } from './dto/register-product.request.dto';
import { UpdateProductPriceRequestDto } from './dto/update-product-price.request.dto';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly registerProductUseCase: RegisterProductUseCase,
    private readonly updateProductPriceUseCase: UpdateProductPriceUseCase
  ) {}

  @Post()
  async registerProduct(
    @Body() request: RegisterProductRequestDto
  ): Promise<RegisterProductOutputDto> {
    return this.registerProductUseCase.execute({
      tenantId: request.tenantId,
      name: request.name,
      barcode: request.barcode,
      unitOfMeasure: request.unitOfMeasure,
      price: request.price
    });
  }

  @Put(':productId/price')
  @HttpCode(HttpStatus.OK)
  async updateProductPrice(
    @Param('productId', new ParseUUIDPipe({ version: '4' })) productId: string,
    @Body() request: UpdateProductPriceRequestDto
  ): Promise<UpdateProductPriceOutputDto> {
    return this.updateProductPriceUseCase.execute({
      tenantId: request.tenantId,
      productId,
      price: request.price
    });
  }
}
