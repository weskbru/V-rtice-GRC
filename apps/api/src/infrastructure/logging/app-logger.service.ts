/**
 * `AppLogger` (T018/T019) — the only supported way application code writes
 * a structured log entry. Wraps the pino instance from `logger.ts` with one
 * method per ADR-012 category, each of which:
 *
 *   - stamps the category itself;
 *   - pulls `correlationId`, `ipAddress`, `userAgent` and `actorUserId` from
 *     the active `RequestContext` (request-context.ts), so call sites never
 *     have to pass them explicitly;
 *   - deliberately OMITS `sessionId` from that automatic enrichment — a
 *     session identifier must never be serializable in logs, only in the
 *     `audit_event` row `AuditRecorder` writes to Postgres (ADR-005,
 *     ADR-012: logs and the audit trail are never the same record);
 *   - runs any caller-supplied `meta` through `sanitizeLogMeta` before
 *     logging it, as defense in depth against a future call site passing a
 *     secret-shaped object.
 */
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

  /** Authentication, authorization failures, rate limiting. */
  security(message: string, meta?: LogMeta): void {
    this.write('security', 'warn', message, meta);
  }

  /** Operational facts about the audit subsystem — never the business trail. */
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
