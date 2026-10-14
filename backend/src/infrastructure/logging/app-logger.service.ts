import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../config/app-config.service';

import { createLogger, sanitizeLogMeta } from './logger';
import { RequestContextStore } from './request-context';

import type { Logger as PinoLogger } from 'pino';

export type LogMeta = Record<string, unknown>;

@Injectable()
export class AppLogger {
  private readonly root: PinoLogger;

  constructor(appConfig: AppConfigService) {
    this.root = createLogger(appConfig.logging);
  }

  security(message: string, meta?: LogMeta): void {
    this.write('security', 'warn', message, meta);
  }

  auditOps(message: string, meta?: LogMeta): void {
    this.write('audit_ops', 'info', message, meta);
  }

  error(message: string, meta?: LogMeta): void {
    this.write('error', 'error', message, meta);
  }

  operational(message: string, meta?: LogMeta): void {
    this.write('operational', 'info', message, meta);
  }

  private write(
    category: 'security' | 'audit_ops' | 'error' | 'operational',
    level: 'warn' | 'info' | 'error',
    message: string,
    meta?: LogMeta,
  ): void {
    const context = RequestContextStore.get();
    const enrichment = context
      ? {
          correlationId: context.correlationId,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          ...(context.actorUserId ? { actorUserId: context.actorUserId } : {}),
        }
      : {};

    const payload = {
      category,
      ...enrichment,
      ...(meta ? (sanitizeLogMeta(meta) as LogMeta) : {}),
    };

    this.root[level](payload, message);
  }
}
