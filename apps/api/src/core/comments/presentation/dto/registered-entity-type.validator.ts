import { registerDecorator } from 'class-validator';

import {
  isAttachableEntityTypeRegistered,
  isCommentableEntityTypeRegistered,
} from '../../domain/entity-registry';

import type { ValidationOptions } from 'class-validator';

export function IsRegisteredCommentableEntityType(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isRegisteredCommentableEntityType',
      target: object.constructor,
      propertyName: propertyName as string,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate(value: unknown): boolean {
          return isCommentableEntityTypeRegistered(value);
        },
      },
    });
  };
}

export function IsRegisteredAttachableEntityType(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function (object: object, propertyName: string | symbol): void {
    registerDecorator({
      name: 'isRegisteredAttachableEntityType',
      target: object.constructor,
      propertyName: propertyName as string,
      ...(validationOptions ? { options: validationOptions } : {}),
      validator: {
        validate(value: unknown): boolean {
          return isAttachableEntityTypeRegistered(value);
        },
      },
    });
  };
}
