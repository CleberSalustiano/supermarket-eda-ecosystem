import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';

import type { ClosePosSessionOutputDto } from '#/application/dto/close-pos-session.dto';
import type { OpenPosSessionOutputDto } from '#/application/dto/open-pos-session.dto';
import { ClosePosSessionUseCase } from '#/application/use-cases/close-pos-session.use-case';
import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { ClosePosSessionRequestDto } from './dto/close-pos-session.request.dto';
import { OpenPosSessionRequestDto } from './dto/open-pos-session.request.dto';

@Controller('pos-sessions')
export class PosSessionsController {
  constructor(
    private readonly openPosSessionUseCase: OpenPosSessionUseCase,
    private readonly closePosSessionUseCase: ClosePosSessionUseCase
  ) {}

  @Post()
  async openSession(@Body() request: OpenPosSessionRequestDto): Promise<OpenPosSessionOutputDto> {
    return this.openPosSessionUseCase.execute({
      tenantId: request.tenantId,
      registerId: request.registerId,
      operatorId: request.operatorId,
      openingFloatAmount: request.openingFloatAmount
    });
  }

  @Post(':sessionId/closure')
  @HttpCode(HttpStatus.OK)
  async closeSession(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() request: ClosePosSessionRequestDto
  ): Promise<ClosePosSessionOutputDto> {
    return this.closePosSessionUseCase.execute({
      tenantId: request.tenantId,
      sessionId,
      declaredCashAmount: request.declaredCashAmount
    });
  }
}
