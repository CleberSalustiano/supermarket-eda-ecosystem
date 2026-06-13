import { IsUUID, Matches } from 'class-validator';

export class GenerateProfitAndLossReportQueryDto {
  @IsUUID('4')
  tenantId!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate!: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate!: string;
}
