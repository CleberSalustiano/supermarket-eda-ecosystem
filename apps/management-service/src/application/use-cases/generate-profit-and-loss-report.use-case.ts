import { Inject, Injectable } from '@nestjs/common';

import { DomainValidationError } from '@supermarket/shared-domain';

import type {
  GenerateProfitAndLossReportInputDto,
  GenerateProfitAndLossReportOutputDto,
  ProfitAndLossReportDayDto
} from '../dto/generate-profit-and-loss-report.dto';
import type { ManagementTransactionRunnerPort } from '../ports/management-transaction-runner.port';
import { MANAGEMENT_TRANSACTION_RUNNER } from '../ports/management-transaction-runner.port';

@Injectable()
export class GenerateProfitAndLossReportUseCase {
  constructor(
    @Inject(MANAGEMENT_TRANSACTION_RUNNER)
    private readonly transactionRunner: ManagementTransactionRunnerPort
  ) {}

  async execute(
    input: GenerateProfitAndLossReportInputDto
  ): Promise<GenerateProfitAndLossReportOutputDto> {
    const tenantId = normalizeRequiredString(input.tenantId, 'Tenant id');
    const fromDate = normalizeBusinessDate(input.fromDate, 'From date');
    const toDate = normalizeBusinessDate(input.toDate, 'To date');

    if (fromDate > toDate) {
      throw new DomainValidationError('From date cannot be later than to date');
    }

    return this.transactionRunner.execute(
      async ({ financialEntryRepository, inventoryLossEntryRepository }) => {
        const [financialSummaries, lossSummaries] = await Promise.all([
          financialEntryRepository.summarizeByBusinessDateRange(tenantId, fromDate, toDate),
          inventoryLossEntryRepository.summarizeByBusinessDateRange(tenantId, fromDate, toDate)
        ]);

        const financialByDate = new Map(
          financialSummaries.map((summary) => [summary.businessDate, summary])
        );
        const lossesByDate = new Map(lossSummaries.map((summary) => [summary.businessDate, summary]));

        const days = buildBusinessDateRange(fromDate, toDate).map((businessDate) => {
          const financialSummary = financialByDate.get(businessDate);
          const lossSummary = lossesByDate.get(businessDate);
          const revenueNetTotal = financialSummary?.revenueNetTotal ?? 0;
          const inventoryLossTotal = lossSummary?.lossAmountTotal ?? 0;

          return {
            businessDate,
            revenueNetTotal,
            inventoryLossTotal,
            profitAndLossTotal: Number.parseFloat(
              (revenueNetTotal - inventoryLossTotal).toFixed(2)
            ),
            netSalesCount: financialSummary?.netSalesCount ?? 0,
            soldItemsQuantity: financialSummary?.soldItemsQuantity ?? 0,
            lossEventsCount: lossSummary?.lossEventsCount ?? 0,
            lossItemsQuantity: lossSummary?.lossItemsQuantity ?? 0
          } satisfies ProfitAndLossReportDayDto;
        });

        return {
          tenantId,
          fromDate,
          toDate,
          revenueNetTotal: sumMoney(days.map((day) => day.revenueNetTotal)),
          inventoryLossTotal: sumMoney(days.map((day) => day.inventoryLossTotal)),
          profitAndLossTotal: sumMoney(days.map((day) => day.profitAndLossTotal)),
          netSalesCount: days.reduce((total, day) => total + day.netSalesCount, 0),
          soldItemsQuantity: days.reduce((total, day) => total + day.soldItemsQuantity, 0),
          lossEventsCount: days.reduce((total, day) => total + day.lossEventsCount, 0),
          lossItemsQuantity: days.reduce((total, day) => total + day.lossItemsQuantity, 0),
          days
        };
      }
    );
  }
}

function normalizeRequiredString(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (normalizedValue.length === 0) {
    throw new DomainValidationError(`${label} cannot be empty`);
  }

  return normalizedValue;
}

function normalizeBusinessDate(value: string, label: string): string {
  const normalizedValue = value.trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalizedValue)) {
    throw new DomainValidationError(`${label} must use the YYYY-MM-DD format`);
  }

  return normalizedValue;
}

function buildBusinessDateRange(fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  const currentDate = new Date(`${fromDate}T00:00:00.000Z`);
  const lastDate = new Date(`${toDate}T00:00:00.000Z`);

  while (currentDate.getTime() <= lastDate.getTime()) {
    dates.push(currentDate.toISOString().slice(0, 10));
    currentDate.setUTCDate(currentDate.getUTCDate() + 1);
  }

  return dates;
}

function sumMoney(values: number[]): number {
  return Number.parseFloat(values.reduce((total, value) => total + value, 0).toFixed(2));
}
