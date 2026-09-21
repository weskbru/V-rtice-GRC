/**
 * F-22 defect 1 fix — custom `class-validator` decorators that validate an
 * `entityType` field against the LIVE attachable/commentable entity-type
 * registry (`core/comments/domain/entity-registry.ts`), instead of a
 * hand-maintained literal array declared per DTO
 * (`const COMMENTABLE_ENTITY_TYPE_VALUES: readonly CommentableEntityType[]
 * = ['RISK']`, the exact shape T206a's probe found rejecting a registered,
 * working entity type at the HTTP boundary before the registry was ever
 * consulted).
 *
 * ## Why a custom validator, not `@IsIn(getRegisteredXEntityTypes())`
 *
 * `class-validator` decorators run their FACTORY (the call that produces
 * the decorator, e.g. `IsIn(someArray)`) exactly once, when the class body
 * is evaluated — i.e. at MODULE IMPORT time. Whatever `someArray` was at
 * that instant is what `@IsIn` checks forever after, even if the array is
 * later mutated or a fresh one is computed by calling a function again
 * later — because the factory itself is never called again.
 * `registerAttachableEntityType`/`registerCommentableEntityType` are only
 * called from each owning module's OWN composition root (`RiskModule`'s
 * constructor, for `RISK`), which Nest invokes during application
 * bootstrap — an event with no defined ordering relative to when THIS
 * file happens to be first imported (a test importing the DTO directly,
 * or Nest resolving the module graph in a different order). `@IsIn` bound
 * to a snapshot taken at import time can therefore run BEFORE the
 * registration it needs to see — precisely the shape of bug F-22 already
 * found once, live, in a test fixture that snapshotted the permission
 * list at import time before any module constructor had run.
 *
 * `registerDecorator`'s `validate(value)` callback, by contrast, is
 * invoked by `class-validator` at REQUEST-VALIDATION time — for every
 * single request, well after Nest's `app.init()` has finished
 * constructing every module (Nest never serves a request until `init()`
 * resolves). Reading `isAttachableEntityTypeRegistered`/
 * `isCommentableEntityTypeRegistered` from inside that callback — rather
 * than capturing their result once — means every request is checked
 * against whatever is registered NOW, never a stale snapshot. A
 * registered type (including one registered by a module built after this
 * file was written) is accepted; an unregistered one (including a
 * syntactically valid but never-wired-up Prisma enum member, e.g.
 * `PROBE_RECORD`) is refused with the SAME message `@IsIn` used before —
 * the fix changes WHEN the check runs and WHAT it consults, not the
 * caller-visible behaviour for an invalid type.
 */
import { registerDecorator } from 'class-validator';

import {
  isAttachableEntityTypeRegistered,
  isCommentableEntityTypeRegistered,
} from '../../domain/entity-registry';

import type { ValidationOptions } from 'class-validator';

/** Validates that the decorated property is a CURRENTLY registered
 * `CommentableEntityType` (see this file's header for why "currently"
 * matters). Usage mirrors `@IsIn(...)`: pass `{ message: ... }` from the
 * pt-BR catalog exactly as before. */
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

/** Same as {@link IsRegisteredCommentableEntityType}, for
 * `AttachableEntityType`. Lives in `core/comments/presentation` alongside
 * its sibling rather than duplicated in `core/files`: `core/files` already
 * imports `core/comments/domain/entity-registry.ts` directly (see that
 * file's own header — "a legitimate cross-capability `core` import"), and
 * `eslint.config.mjs`'s boundary rules leave cross-capability `core/**`
 * imports unrestricted. */
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
