import { Controller, Get, Query } from '@nestjs/common';

import type { GenerateProfitAndLossReportOutputDto } from '#/application/dto/generate-profit-and-loss-report.dto';
import { GenerateProfitAndLossReportUseCase } from '#/application/use-cases/generate-profit-and-loss-report.use-case';
import { GenerateProfitAndLossReportQueryDto } from './dto/generate-profit-and-loss-report.query.dto';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly generateProfitAndLossReportUseCase: GenerateProfitAndLossReportUseCase
  ) {}

  @Get('profit-and-loss')
  async generateProfitAndLossReport(
    @Query() query: GenerateProfitAndLossReportQueryDto
  ): Promise<GenerateProfitAndLossReportOutputDto> {
    return this.generateProfitAndLossReportUseCase.execute({
      tenantId: query.tenantId,
      fromDate: query.fromDate,
      toDate: query.toDate
    });
  }
}
