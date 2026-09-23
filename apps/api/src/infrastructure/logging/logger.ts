import pino, { type Logger as PinoLogger, type LoggerOptions } from 'pino';

import type { LoggingSettings } from '../config/app-config.service';

export type LogCategory = 'security' | 'audit_ops' | 'error' | 'operational';

export const LOG_REDACTION_PATHS: readonly string[] = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
  'headers.cookie',
  'headers.authorization',
  'headers["set-cookie"]',
];

const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|cookie|authorization|session[-_]?id|sessiontoken|api[-_]?key|credential|hash)/i;

const MAX_SANITIZE_DEPTH = 6;
const REDACTED = '[REDACTED]';

const WINDOWS_ABS_PATH_PATTERN = /[A-Za-z]:\\(?:[^\r\n"]+\\)+[^\r\n"]+/g;
const UNIX_ABS_PATH_PATTERN = /\/(?:home|Users|usr|var|etc|opt|root)\/[^\s"]+/g;
const REDACTED_PATH = '[redacted-path]';

export function redactAbsoluteFilePaths(text: string): string {
  return text
    .replace(WINDOWS_ABS_PATH_PATTERN, REDACTED_PATH)
    .replace(UNIX_ABS_PATH_PATTERN, REDACTED_PATH);
}

export function sanitizeLogMeta(value: unknown, depth = 0): unknown {
  if (depth >= MAX_SANITIZE_DEPTH || value === null || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date || value instanceof Error) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeLogMeta(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    result[key] = SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeLogMeta(entry, depth + 1);
  }
  return result;
}

export function createLogger(settings: LoggingSettings): PinoLogger {
  const options: LoggerOptions = {
    level: settings.level,
    redact: { paths: [...LOG_REDACTION_PATHS], censor: REDACTED },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (settings.pretty) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:standard' },
      },
    });
  }

  return pino(options);
}
