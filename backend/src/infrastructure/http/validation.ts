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
