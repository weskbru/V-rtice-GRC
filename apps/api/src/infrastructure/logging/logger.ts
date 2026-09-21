/**
 * Structured logging (T018 / ADR-012).
 *
 * `pino`, four explicit categories on every entry:
 *
 *   - `security`     — authentication, authorization failures, rate limiting
 *   - `audit_ops`     — operational facts about the audit subsystem itself
 *                        (e.g. "audit write failed"), never the business
 *                        trail (that lives in `audit_event`, ADR-005 — logs
 *                        and the audit trail are never the same record)
 *   - `error`         — unexpected failures
 *   - `operational`   — everything else (requests, lifecycle, startup)
 *
 * Two layers of defense make sure "no secret, token, session id or
 * password may ever be serializable" (working rule) actually holds:
 *
 *   1. `LOG_REDACTION_PATHS` — pino's own path-based `redact` option,
 *      covering the header shapes (`req.headers.cookie`,
 *      `req.headers.authorization`, ...) most likely to appear when an
 *      HTTP framework's own objects are logged directly.
 *   2. `sanitizeLogMeta` — a recursive scrub applied to every caller-supplied
 *      metadata object (in `AppLogger`, below) that redacts any key whose
 *      *name* matches a sensitive pattern, regardless of nesting depth or
 *      exact path. This is what actually protects arbitrary
 *      business-metadata objects future call sites pass in — pino's static
 *      path list cannot anticipate every shape a later module will log.
 *
 * `LOG_LEVEL`/`LOG_PRETTY` (from `.env.example`) are read once, through
 * `AppConfigService`, never through `process.env` directly.
 */
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

/**
 * Case-insensitive match on key *names* — deliberately name-based rather
 * than path-based, so it catches a sensitive field however deeply it is
 * nested in a metadata object a future call site passes in.
 */
const SENSITIVE_KEY_PATTERN =
  /(password|passwd|secret|token|cookie|authorization|session[-_]?id|sessiontoken|api[-_]?key|credential|hash)/i;

const MAX_SANITIZE_DEPTH = 6;
const REDACTED = '[REDACTED]';

/**
 * S-11 (audit A6-F02): an absolute filesystem path embedded inside a
 * string value — most commonly a `PrismaClientKnownRequestError.message`,
 * which `@prisma/client` itself generates with a "code frame" citing the
 * absolute source path of the call site (e.g. `Invalid ... invocation in
 * D:\dev\pharos-grc\apps\api\src\...\foo.ts:181:35`). This is never
 * written by this codebase's own code — it is a property of the Prisma
 * client library — so `sanitizeLogMeta`'s name-based key redaction cannot
 * catch it: the offending value lives under an innocuous key like
 * `message`, not a key matching `SENSITIVE_KEY_PATTERN`.
 *
 * Deliberately NOT applied to a `stack` value — `information-disclosure.
 * spec.ts` documents that exception explicitly: a stack trace (and the
 * absolute paths inside it) in a server-side OPERATIONAL LOG is
 * intentional, standard incident-response practice, never returned to a
 * client. Only `message` (and any other non-`stack` field) needs this.
 *
 * Same two shapes `information-disclosure.spec.ts`'s own
 * `WINDOWS_ABS_PATH`/`UNIX_ABS_PATH` patterns check for, applied globally
 * (not just matched-and-reported) so the offending substring is actually
 * removed rather than merely detected.
 */
const WINDOWS_ABS_PATH_PATTERN = /[A-Za-z]:\\(?:[^\r\n"]+\\)+[^\r\n"]+/g;
const UNIX_ABS_PATH_PATTERN = /\/(?:home|Users|usr|var|etc|opt|root)\/[^\s"]+/g;
const REDACTED_PATH = '[redacted-path]';

/**
 * Replaces every absolute Windows or POSIX filesystem path in `text` with
 * `[redacted-path]`, preserving everything else — the Prisma error code,
 * the model/operation name, line/column numbers — so the log entry stays
 * useful for diagnosis without ever carrying the server's own source
 * layout (FR-107/FR-108 apply to logs too, not only HTTP responses, per
 * this file's own header).
 */
export function redactAbsoluteFilePaths(text: string): string {
  return text
    .replace(WINDOWS_ABS_PATH_PATTERN, REDACTED_PATH)
    .replace(UNIX_ABS_PATH_PATTERN, REDACTED_PATH);
}

/**
 * Recursively replaces the value of any object key matching
 * `SENSITIVE_KEY_PATTERN` with `"[REDACTED]"`. Bounded depth guards against
 * cyclic or pathologically deep objects; anything past the bound is
 * dropped rather than serialized, which is the safe direction to fail in.
 */
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
