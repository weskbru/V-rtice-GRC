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
  readonly retryAfterSeconds?: number | undefined;
  readonly extra?: Record<string, unknown> | undefined;
  readonly etag?: string | undefined;
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpContext = host.switchToHttp();
    const response = httpContext.getResponse<Response>();
    const requestPath = httpContext.getRequest<{ originalUrl?: string; url?: string }>();
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

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      title: USER_MESSAGES.problemTitle.internalServerError,
      detail: GENERIC_SERVER_ERROR_DETAIL,
      type: `${PROBLEM_TYPE_BASE}/internal-error`,
    };
  }

  private fromDomainError(exception: DomainError): ExceptionShape {
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
      message:
        exception instanceof Error ? redactAbsoluteFilePaths(exception.message) : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (shape.status >= 500) {
      this.logger.error('Unhandled exception reached the global filter.', meta);
      return;
    }

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
