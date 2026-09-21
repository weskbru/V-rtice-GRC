/**
 * Global `ValidationPipe` (T022 / FR-106 / FR-059).
 *
 * `whitelist: true` strips any property not declared on the target DTO;
 * `forbidNonWhitelisted: true` rejects the request outright instead of
 * silently dropping the extra property — a client sending a field it has no
 * business sending (e.g. a derived risk score, ADR-006) gets a `400`, not a
 * response that quietly ignored it. `transform: true` so path/query
 * parameters are coerced to the DTO's declared types before validation runs
 * (needed for `page`/`pageSize` numbers, T020's pagination primitives).
 *
 * The default `ValidationPipe` throws a plain `BadRequestException` whose
 * body is `{ statusCode, message: string[], error }` — Nest's default shape,
 * not the RFC 9457 problem+json envelope ADR-009 requires. `exceptionFactory`
 * below instead builds `ValidationFieldError[]` (shared/errors) from
 * `class-validator`'s `ValidationError[]` and throws a `BadRequestException`
 * carrying that structured payload; `ProblemDetailsFilter` (T021) — which
 * runs on every exception unconditionally — is what actually renders it as
 * problem+json. So request-shape validation failures never reach Nest's
 * default error handling at any point in the pipeline.
 */
import { BadRequestException, ValidationPipe } from '@nestjs/common';

import { USER_MESSAGES } from '../../shared/messages/user-messages';

import type { ValidationFieldError } from '../../shared/errors/domain-error';
import type { ValidationError } from 'class-validator';

function flattenValidationErrors(
  errors: readonly ValidationError[],
  parentPath = '',
): ValidationFieldError[] {
  const result: ValidationFieldError[] = [];

  for (const error of errors) {
    const path = parentPath ? `${parentPath}.${error.property}` : error.property;

    if (error.constraints) {
      for (const message of Object.values(error.constraints)) {
        result.push({ field: path, message });
      }
    }

    if (error.children && error.children.length > 0) {
      result.push(...flattenValidationErrors(error.children, path));
    }
  }

  return result;
}

export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (validationErrors: ValidationError[]) => {
      const errors = flattenValidationErrors(validationErrors);
      return new BadRequestException({
        title: USER_MESSAGES.validation.requestValidationFailedTitle,
        detail: USER_MESSAGES.validation.requestValidationFailedDetail,
        errors,
      });
    },
  });
}
