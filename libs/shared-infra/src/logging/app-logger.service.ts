import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class AppLoggerService extends ConsoleLogger {
  setServiceContext(serviceName: string): void {
    this.setContext(serviceName);
  }
}
