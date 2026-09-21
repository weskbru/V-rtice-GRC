/**
 * S-01 (audit A6-F01) — `MandatoryPasswordChangeGuard`.
 *
 * `LocalCredential.mustChangePassword` (set on every newly created user and
 * on every administrative password reset) was, before this guard, informative
 * only: `POST /auth/login` returned it so `apps/web` could redirect to the
 * password-change screen, but nothing on the server refused a request that
 * ignored the redirect. A direct API call (curl, a script, any client other
 * than `apps/web`) could use the whole API normally without ever calling
 * `POST /auth/me/password` — reproduced live during the audit: create a user,
 * log in, call `GET /risks` with the session cookie, get `200`.
 *
 * Registered as a global guard (`app.module.ts`) immediately after
 * `SessionGuard` and before `PermissionGuard` — it reads the session
 * `SessionGuard` already resolved and attached to the request
 * (`readPharosAuth`) rather than re-validating anything itself, and it must
 * run before `PermissionGuard` so a refusal here is reported as "you must
 * change your password", not folded into an unrelated permission decision.
 *
 * ## Deny by default, narrow allowlist
 *
 *   1. `@Public()` — the route never had a session to check in the first
 *      place (login, health checks); same bypass as `SessionGuard`/
 *      `PermissionGuard`.
 *   2. No session attached to the request — nothing for this guard to
 *      enforce; `SessionGuard` already refused an invalid/missing session
 *      before this guard could run, and `PermissionGuard`'s own "no actor"
 *      handling covers any other case. This guard's job is narrower than
 *      authentication itself.
 *   3. `session.mustChangePassword === false` — the normal case, proceed.
 *   4. `session.mustChangePassword === true` and the handler carries
 *      `@AllowedDuringMandatoryPasswordChange()` — the small, explicit set
 *      of routes the password-change flow itself needs (own
 *      session/profile, change password, logout) — proceed.
 *   5. Otherwise — refused with `PasswordChangeRequiredDomainError` (403,
 *      its own problem `type`), uniformly, for every other route.
 *
 * ## No dedicated `audit_event` for this refusal — a deliberate choice
 *
 * `ProblemDetailsFilter.logException` already logs every 403 via
 * `AppLogger.security` (correlation id, actor, status) — this refusal is
 * not silent. A SEPARATE, permanent `audit_event` row (the pattern
 * `auth.login_refused_locked`/`PermissionGuard`'s `DENIED` recording use)
 * was deliberately not added here: those events correlate to a specific
 * security POLICY decision (an account lockout, a caller lacking a
 * permission anywhere in the RBAC model) — a materially different signal
 * from "a user who was just created or reset has not yet completed the
 * mandatory first step of using the product". Every such user hits this
 * refusal on every non-exempt call until they change their password — a
 * routine, expected part of onboarding, not an anomaly — so recording a
 * permanent audit row per blocked call would add high-volume, low-signal
 * noise to a trail CLAUDE.md §8 wants reserved for relevant events. The
 * security log already gives an operator a searchable trail if this
 * refusal ever needs investigating.
 */
import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY } from '../../../shared/access/allowed-during-mandatory-password-change.decorator';
import { IS_PUBLIC_KEY } from '../../../shared/access/public.decorator';
import { PasswordChangeRequiredDomainError } from '../../../shared/errors/domain-error';

import { readPharosAuth } from './session.guard';

import type { Request } from 'express';

@Injectable()
export class MandatoryPasswordChangeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic === true) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const session = readPharosAuth(request);
    if (!session?.mustChangePassword) {
      return true;
    }

    const allowedDuringChange = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOWED_DURING_MANDATORY_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowedDuringChange === true) {
      return true;
    }

    throw new PasswordChangeRequiredDomainError();
  }
}
