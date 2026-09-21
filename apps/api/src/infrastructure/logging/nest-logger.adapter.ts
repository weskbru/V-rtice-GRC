/**
 * Adapts `AppLogger` to Nest's `LoggerService` interface so framework
 * bootstrap/lifecycle messages (normally printed by Nest's own `Logger`)
 * flow through the same structured pino output and redaction as the rest
 * of the application (ADR-012). Wired in `main.ts` via
 * `NestFactory.create(AppModule, { bufferLogs: true })` +
 * `app.useLogger(app.get(NestLoggerAdapter))`.
 */
import { Injectable, type LoggerService } from '@nestjs/common';

import { AppLogger } from './app-logger.service';

@Injectable()
export class NestLoggerAdapter implements LoggerService {
  constructor(private readonly appLogger: AppLogger) {}

  log(message: unknown, context?: string): void {
    this.appLogger.operational(String(message), context ? { context } : undefined);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.appLogger.error(String(message), {
      ...(trace ? { trace } : {}),
      ...(context ? { context } : {}),
    });
  }

  warn(message: unknown, context?: string): void {
    this.appLogger.operational(String(message), context ? { context, level: 'warn' } : undefined);
  }

  debug(message: unknown, context?: string): void {
    this.appLogger.operational(String(message), context ? { context, level: 'debug' } : undefined);
  }

  verbose(message: unknown, context?: string): void {
    this.appLogger.operational(
      String(message),
      context ? { context, level: 'verbose' } : undefined,
    );
  }
}
