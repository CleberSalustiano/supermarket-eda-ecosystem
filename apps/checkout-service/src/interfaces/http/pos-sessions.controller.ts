import { Body, Controller, Post } from '@nestjs/common';

import type { OpenPosSessionOutputDto } from '#/application/dto/open-pos-session.dto';
import { OpenPosSessionUseCase } from '#/application/use-cases/open-pos-session.use-case';
import { OpenPosSessionRequestDto } from './dto/open-pos-session.request.dto';

@Controller('pos-sessions')
export class PosSessionsController {
  constructor(private readonly openPosSessionUseCase: OpenPosSessionUseCase) {}

  @Post()
  async openSession(@Body() request: OpenPosSessionRequestDto): Promise<OpenPosSessionOutputDto> {
    return this.openPosSessionUseCase.execute({
      tenantId: request.tenantId,
      registerId: request.registerId,
      operatorId: request.operatorId,
      openingFloatAmount: request.openingFloatAmount
    });
  }
}
