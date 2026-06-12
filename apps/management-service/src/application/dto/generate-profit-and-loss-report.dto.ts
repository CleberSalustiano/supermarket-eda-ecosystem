export interface GenerateProfitAndLossReportInputDto {
  tenantId: string;
  fromDate: string;
  toDate: string;
}

export interface ProfitAndLossReportDayDto {
  businessDate: string;
  revenueNetTotal: number;
  inventoryLossTotal: number;
  profitAndLossTotal: number;
  netSalesCount: number;
  soldItemsQuantity: number;
  lossEventsCount: number;
  lossItemsQuantity: number;
}

export interface GenerateProfitAndLossReportOutputDto {
  tenantId: string;
  fromDate: string;
  toDate: string;
  revenueNetTotal: number;
  inventoryLossTotal: number;
  profitAndLossTotal: number;
  netSalesCount: number;
  soldItemsQuantity: number;
  lossEventsCount: number;
  lossItemsQuantity: number;
  days: ProfitAndLossReportDayDto[];
}
