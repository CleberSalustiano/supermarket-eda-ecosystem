import { clearInterval, setInterval } from 'timers';

import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';

import type { ServiceEnvironment } from '@supermarket/shared-infra';
import { AppLoggerService, SERVICE_ENVIRONMENT } from '@supermarket/shared-infra';

import { EmitLowStockAlertsUseCase } from '#/application/use-cases/emit-low-stock-alerts.use-case';
import {
  LOW_STOCK_ALERT_OPTIONS,
  type LowStockAlertOptions
} from '#/application/ports/low-stock-alert.options';

@Injectable()
export class LowStockAlertWorkerService implements OnModuleInit, OnApplicationShutdown {
  private interval?: NodeJS.Timeout;
  private runInFlight = false;

  constructor(
    @Inject(SERVICE_ENVIRONMENT)
    private readonly environment: ServiceEnvironment,
    private readonly logger: AppLoggerService,
    private readonly emitLowStockAlertsUseCase: EmitLowStockAlertsUseCase,
    @Inject(LOW_STOCK_ALERT_OPTIONS)
    private readonly options: LowStockAlertOptions
  ) {}

  onModuleInit(): void {
    if (this.environment.nodeEnvironment === 'test') {
      return;
    }

    this.interval = setInterval(() => {
      void this.runNow();
    }, this.options.intervalMs);
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  async runNow(): Promise<void> {
    if (this.runInFlight) {
      return;
    }

    this.runInFlight = true;

    try {
      const result = await this.emitLowStockAlertsUseCase.execute();

      if (result.emittedBatches.length > 0) {
        this.logger.log(
          `Emitted ${result.emittedBatches.length} low stock alert batches from ${result.scannedCandidates} candidates`
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Unknown error while emitting low stock alerts';

      this.logger.error(
        `Failed to emit low stock alerts: ${message}`,
        error instanceof Error ? error.stack : undefined
      );
    } finally {
      this.runInFlight = false;
    }
  }
}
