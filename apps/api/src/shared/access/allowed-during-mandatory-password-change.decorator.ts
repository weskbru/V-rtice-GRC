/**
 * S-01 (audit A6-F01) — `@AllowedDuringMandatoryPasswordChange()`.
 *
 * Same shape and placement as `@Public()` (this same directory) and
 * `@NoPermissionRequired()` (`core/authorization/presentation/permission.guard.ts`):
 * a narrow, explicit, auditable opt-in read by `MandatoryPasswordChangeGuard`
 * (`core/sessions/presentation`), the guard registered immediately after
 * `SessionGuard` in the global chain (`app.module.ts`).
 *
 * Marks a handler (or every handler on a controller) as safe to reach even
 * when the caller's session belongs to a user with
 * `LocalCredential.mustChangePassword === true` — i.e. a route the
 * mandatory password-change flow itself needs to function: reading the
 * caller's own session/profile, changing the password, and signing out.
 * Every other authenticated route is refused with
 * `PasswordChangeRequiredDomainError` (403) while that flag is `true`
 * (`shared/errors/domain-error.ts`).
 *
 * Unlike `@Public()`, this does NOT bypass `SessionGuard` or
 * `PermissionGuard` — it carries no `@Public()`/`@NoPermissionRequired()`
 * metadata of its own, so a route still needs its own, ordinary permission
 * annotation (or `@NoPermissionRequired()`) to pass `PermissionGuard`. This
 * decorator only ever narrows what `MandatoryPasswordChangeGuard` refuses.
 */
import { SetMetadata } from '@nestjs/common';

export const ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY =
  'pharos:allowedDuringMandatoryPasswordChange';

export const AllowedDuringMandatoryPasswordChange = (): MethodDecorator & ClassDecorator =>
  SetMetadata(ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY, true);
