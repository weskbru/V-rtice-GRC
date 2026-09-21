/**
 * Global exception filter (T021 / ADR-009 / FR-030 / FR-107).
 *
 * `@Catch()` with no argument — every exception, `DomainError`, Nest
 * `HttpException` (including whatever `ValidationPipe`'s `exceptionFactory`,
 * T022, throws) and any unexpected error (a bug, a driver-level Postgres
 * error) — is funneled through here, so Nest's own default HTML/JSON error
 * pages never render and the client-visible shape is uniform.
 *
 * Hard rule (FR-107/FR-108, working rule for T014-T025): this filter must
 * NEVER put a stack trace, an internal identifier, a raw database message
 * or a secret into the response. Everything beyond the safe, mapped
 * `detail` is logged server-side (via `AppLogger`) and only a
 * `correlationId` is returned, so an operator can find the full detail in
 * logs without the client ever seeing it.
 *
 * Status mapping:
 *   - `UnauthorizedDomainError`                       -> 401
 *   - `ForbiddenDomainError`                           -> 403
 *   - `NotFoundDomainError`                            -> 404
 *   - `OptimisticLockDomainError` / `ConflictDomainError` -> 409
 *   - `ValidationDomainError` (business-rule failure)  -> 422
 *   - Nest `HttpException` (incl. `ValidationPipe`'s request-shape
 *     failures, T022)                                  -> its own status
 *   - anything else (unexpected)                       -> 500, generic detail
 *
 * FR-030: a caller who lacks access to a record that also must not have its
 * existence disclosed is expected to be refused with `NotFoundDomainError`
 * (404) at the application layer, not `ForbiddenDomainError` (403) — this
 * filter only maps whichever error it is handed; that choice is made by the
 * application/authorization layer that throws it.
 */
import { randomUUID } from 'node:crypto';

import {
  Catch,
  HttpException,
  HttpStatus,
  PayloadTooLargeException,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';

import {
  DomainError,
  OptimisticLockDomainError,
  RateLimitedDomainError,
  ValidationDomainError,
  type ValidationFieldError,
} from '../../shared/errors/domain-error';
import { USER_MESSAGES } from '../../shared/messages/user-messages';
import { AppLogger } from '../logging/app-logger.service';
import { redactAbsoluteFilePaths } from '../logging/logger';
import { CORRELATION_ID_HEADER, RequestContextStore } from '../logging/request-context';

import { PROBLEM_JSON_CONTENT_TYPE, type ProblemDetails } from './problem-details';

import type { Response } from 'express';

const GENERIC_SERVER_ERROR_DETAIL = USER_MESSAGES.server.unexpectedError;
const PROBLEM_TYPE_BASE = 'https://pharosgrc.dev/problems';

/**
 * Fallback `title` by HTTP status, used only when an `HttpException`'s body
 * carries no explicit `title` of its own (`fromHttpException` below) — e.g.
 * Nest's own built-in exceptions (unmatched route, method not allowed),
 * which are not thrown anywhere in this codebase's application code today
 * but can still originate from the framework itself. Keeps every
 * client-visible title in pt-BR rather than leaking an English exception
 * class name (`exception.name`) for those framework-originated cases.
 */
const STATUS_TITLES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: USER_MESSAGES.problemTitle.badRequest,
  [HttpStatus.UNAUTHORIZED]: USER_MESSAGES.problemTitle.unauthorized,
  [HttpStatus.FORBIDDEN]: USER_MESSAGES.problemTitle.forbidden,
  [HttpStatus.NOT_FOUND]: USER_MESSAGES.problemTitle.notFound,
  [HttpStatus.CONFLICT]: USER_MESSAGES.problemTitle.conflict,
  [HttpStatus.UNPROCESSABLE_ENTITY]: USER_MESSAGES.problemTitle.unprocessableEntity,
  [HttpStatus.TOO_MANY_REQUESTS]: USER_MESSAGES.problemTitle.tooManyRequests,
  [HttpStatus.INTERNAL_SERVER_ERROR]: USER_MESSAGES.problemTitle.internalServerError,
};

interface ExceptionShape {
  readonly status: number;
  readonly title: string;
  readonly detail: string;
  readonly type: string;
  readonly errors?: readonly ValidationFieldError[];
  /** Present only for `RATE_LIMITED` (T066, FR-008) — forwarded as the
   * `Retry-After` response header, never embedded in a more specific body
   * detail (auth.openapi.yaml: the 429 body never discloses account state). */
  readonly retryAfterSeconds?: number | undefined;
  /** Present only for `OptimisticLockDomainError` (ADR-013) — merged into
   * the problem body as `VersionConflictProblem`'s own extra fields
   * (`currentVersion`, `currentStatus`). */
  readonly extra?: Record<string, unknown> | undefined;
  /** Present only for `OptimisticLockDomainError` (ADR-013) — echoed back
   * as the response's `ETag` header, exactly like a successful `GET`/write,
   * so the client can retry with `If-Match` set to the now-current value
   * without a second `GET`. */
  readonly etag?: string | undefined;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const requestPath = httpContext.getRequest<{ originalUrl?: string; url?: string }>();
    // F-41 (`docs/deferred-findings.md`): a request whose body Express's own
    // `json()` body-parser rejects (invalid JSON syntax) never reaches
    // `RequestContextMiddleware` — Express error propagation skips every
    // ordinary middleware mounted after the point a middleware calls
    // `next(err)`, and the parser throws before Nest's own router (which
    // mounts that middleware) ever runs. `RequestContextStore` is therefore
    // never populated for this one exception class, and the previous
    // literal `'unknown'` fallback made every such response — and its own
    // log line below — permanently unattributable to each other, exactly
    // the guarantee a correlation id exists to provide. Generating a real
    // id here, the same way `RequestContextMiddleware` itself does
    // (`randomUUID()`), and setting the SAME header that middleware sets,
    // keeps this one exception's response and its log entry correlated to
    // EACH OTHER even though nothing upstream saw it — solved at the one
    // choke point every exception already passes through, without moving
    // where Nest registers its own middleware (a separate, genuine
    // architecture question this fix does not decide).
    const correlationId = RequestContextStore.get()?.correlationId ?? randomUUID();
    response.set(CORRELATION_ID_HEADER, correlationId);

    const shape = this.toExceptionShape(exception);
    this.logException(exception, shape, correlationId);

    const problem: ProblemDetails = {
      type: shape.type,
      title: shape.title,
      status: shape.status,
      detail: shape.detail,
      instance: requestPath.originalUrl ?? requestPath.url ?? '',
      correlationId,
      ...(shape.errors && shape.errors.length > 0 ? { errors: shape.errors } : {}),
      ...(shape.extra ?? {}),
    };

    if (shape.retryAfterSeconds !== undefined) {
      response.set('Retry-After', String(shape.retryAfterSeconds));
    }

    if (shape.etag !== undefined) {
      response.set('ETag', `"${shape.etag}"`);
    }

    response.status(shape.status).contentType(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  }

  private toExceptionShape(exception: unknown): ExceptionShape {
    if (exception instanceof DomainError) {
      return this.fromDomainError(exception);
    }

    if (exception instanceof HttpException) {
      return this.fromHttpException(exception);
    }

    // Never surface `exception.message` here: it may be a raw driver
    // message (SQL fragment, filesystem path) that FR-107 forbids returning
    // to a client. Full detail still reaches the logs via `logException`.
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: USER_MESSAGES.problemTitle.internalServerError,
      detail: GENERIC_SERVER_ERROR_DETAIL,
      type: `${PROBLEM_TYPE_BASE}/internal-error`,
    };
  }

  private fromDomainError(exception: DomainError): ExceptionShape {
    // Checked ahead of the `switch` below: `OptimisticLockDomainError`
    // inherits `code: 'CONFLICT'` from `ConflictDomainError` (it does not
    // redeclare `code`, so the `switch`'s own `'OPTIMISTIC_LOCK'` case is
    // unreachable — `DomainErrorCode` names that value, but nothing ever
    // constructs a `DomainError` whose `code` getter returns it). This
    // `instanceof` check is what actually distinguishes an optimistic-lock
    // conflict (ADR-013: `VersionConflictProblem` — `currentVersion`/
    // `currentStatus` in the body, current version echoed as `ETag`) from
    // any other `409`.
    if (exception instanceof OptimisticLockDomainError) {
      return {
        status: HttpStatus.CONFLICT,
        title: USER_MESSAGES.problemTitle.conflict,
        detail: exception.message,
        type: `${PROBLEM_TYPE_BASE}/version-conflict`,
        extra: {
          currentVersion: exception.actualVersion,
          ...(exception.currentStatus !== undefined
            ? { currentStatus: exception.currentStatus }
            : {}),
        },
        etag: String(exception.actualVersion),
      };
    }

    switch (exception.code) {
      case 'UNAUTHORIZED':
        return {
          status: HttpStatus.UNAUTHORIZED,
          title: USER_MESSAGES.problemTitle.unauthorized,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/unauthorized`,
        };
      case 'FORBIDDEN':
        return {
          status: HttpStatus.FORBIDDEN,
          title: USER_MESSAGES.problemTitle.forbidden,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/forbidden`,
        };
      case 'PASSWORD_CHANGE_REQUIRED':
        return {
          status: HttpStatus.FORBIDDEN,
          title: USER_MESSAGES.problemTitle.passwordChangeRequired,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/password-change-required`,
        };
      case 'NOT_FOUND':
        return {
          status: HttpStatus.NOT_FOUND,
          title: USER_MESSAGES.problemTitle.notFound,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/not-found`,
        };
      case 'OPTIMISTIC_LOCK':
        return {
          status: HttpStatus.CONFLICT,
          title: USER_MESSAGES.problemTitle.conflict,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/optimistic-lock`,
        };
      case 'CONFLICT':
        return {
          status: HttpStatus.CONFLICT,
          title: USER_MESSAGES.problemTitle.conflict,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/conflict`,
        };
      case 'VALIDATION': {
        const validationError = exception as ValidationDomainError;
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          title: USER_MESSAGES.problemTitle.unprocessableEntity,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/validation`,
          errors: validationError.errors,
        };
      }
      case 'RATE_LIMITED': {
        const rateLimitedError = exception as RateLimitedDomainError;
        return {
          status: HttpStatus.TOO_MANY_REQUESTS,
          title: USER_MESSAGES.problemTitle.tooManyRequests,
          detail: exception.message,
          type: `${PROBLEM_TYPE_BASE}/rate-limited`,
          retryAfterSeconds: rateLimitedError.retryAfterSeconds,
        };
      }
      default:
        // Exhaustiveness guard: every DomainErrorCode is handled above.
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          title: USER_MESSAGES.problemTitle.internalServerError,
          detail: GENERIC_SERVER_ERROR_DETAIL,
          type: `${PROBLEM_TYPE_BASE}/internal-error`,
        };
    }
  }

  private fromHttpException(exception: HttpException): ExceptionShape {
    const status = exception.getStatus();

    // T190/FR-097 — multer's own `limits.fileSize` rejection
    // (`AttachmentController`'s `MulterModule.registerAsync`) surfaces as
    // this built-in Nest exception BEFORE any application code runs, so it
    // never carries a pt-BR body of its own (Nest's default English "File
    // too large"). Substituted here rather than in application code, since
    // there is no application-layer call site to intercept it at.
    if (exception instanceof PayloadTooLargeException) {
      return {
        status,
        title: USER_MESSAGES.problemTitle.payloadTooLarge,
        detail: USER_MESSAGES.attachment.fileTooLarge,
        type: `${PROBLEM_TYPE_BASE}/http-${String(status)}`,
      };
    }

    const body = exception.getResponse();

    if (typeof body === 'string') {
      return {
        status,
        title: STATUS_TITLES[status] ?? exception.name,
        detail: body,
        type: `${PROBLEM_TYPE_BASE}/http-${String(status)}`,
      };
    }

    const record = body as Record<string, unknown>;

    // F-41 (`docs/deferred-findings.md`) — Express's own `json()`
    // body-parser rejects invalid JSON (`SyntaxError`) or a malformed
    // URI-encoded body (`URIError`) BEFORE any Nest guard, pipe or
    // application code runs; `@nestjs/core`'s `mapExternalException`
    // converts either into `new BadRequestException(err.message)`, which
    // `HttpException.createBody` turns into `{ statusCode, message:
    // err.message, error: 'Bad Request' }` — no `title`, no `detail` of its
    // own. Every `BadRequestException` THIS codebase's own application code
    // throws always sets both explicitly (`validation.ts`'s own
    // `exceptionFactory`; every controller's own `throw new
    // BadRequestException({ title, detail, ... })` — grep-verified, no call
    // site passes a bare string), so a 400 record missing both can only be
    // this exact framework path, and `record.message` is always Node/V8's
    // raw, English, implementation-revealing parser text (FR-107 forbids
    // returning it). Substituted with a fixed, generic pt-BR detail — same
    // defensive pattern as the `PayloadTooLargeException` case above,
    // generalized to the shape rather than one more `instanceof` check
    // (body-parser throws a plain `BadRequestException`, indistinguishable
    // by type from any of this codebase's own).
    const badRequestStatus: number = HttpStatus.BAD_REQUEST;
    if (
      status === badRequestStatus &&
      typeof record.title !== 'string' &&
      typeof record.detail !== 'string' &&
      typeof record.message === 'string'
    ) {
      return {
        status,
        title: USER_MESSAGES.problemTitle.badRequest,
        detail: USER_MESSAGES.server.malformedRequestBody,
        type: `${PROBLEM_TYPE_BASE}/http-${String(status)}`,
      };
    }

    const errors = Array.isArray(record.errors)
      ? (record.errors as ValidationFieldError[])
      : undefined;
    const title =
      typeof record.title === 'string' ? record.title : (STATUS_TITLES[status] ?? exception.name);
    const detail = this.extractDetail(record, exception.message);

    return {
      status,
      title,
      detail,
      type: `${PROBLEM_TYPE_BASE}/http-${String(status)}`,
      ...(errors ? { errors } : {}),
    };
  }

  private extractDetail(record: Record<string, unknown>, fallback: string): string {
    if (typeof record.detail === 'string') {
      return record.detail;
    }
    if (typeof record.message === 'string') {
      return record.message;
    }
    if (Array.isArray(record.message)) {
      return (record.message as unknown[]).map(String).join(' ');
    }
    return fallback;
  }

  private logException(exception: unknown, shape: ExceptionShape, correlationId: string): void {
    const meta = {
      correlationId,
      status: shape.status,
      errorName: exception instanceof Error ? exception.name : typeof exception,
      // Full message/stack are for the log sink only — never returned to
      // the client (see toExceptionShape). `message` is redacted for
      // absolute filesystem paths (S-11, A6-F02): a `PrismaClientKnownRequestError`'s
      // own `.message` embeds one (a "code frame" pointing at the server's
      // source layout), which is not this codebase's content to begin
      // with and `sanitizeLogMeta`'s name-based redaction cannot catch
      // (the value lives under the innocuous key `message`). `stack` is
      // deliberately left untouched — see `redactAbsoluteFilePaths`'s own
      // doc comment for why a stack trace in this operational log is the
      // documented exception, not a leak.
      message:
        exception instanceof Error ? redactAbsoluteFilePaths(exception.message) : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (shape.status >= 500) {
      this.logger.error('Unhandled exception reached the global filter.', meta);
      return;
    }

    // Plain `number` locals (not a direct enum-vs-number comparison) so this
    // reads cleanly under both @typescript-eslint/no-unsafe-enum-comparison
    // and @typescript-eslint/no-unnecessary-type-assertion.
    const unauthorizedStatus: number = HttpStatus.UNAUTHORIZED;
    const forbiddenStatus: number = HttpStatus.FORBIDDEN;
    const tooManyRequestsStatus: number = HttpStatus.TOO_MANY_REQUESTS;

    if (
      shape.status === unauthorizedStatus ||
      shape.status === forbiddenStatus ||
      shape.status === tooManyRequestsStatus
    ) {
      this.logger.security('Request rejected by authentication/authorization.', meta);
      return;
    }

    this.logger.operational('Request rejected.', meta);
  }
}
