/**
 * T035 — `PermissionGuard` and `@RequirePermission` (ADR-003, FR-021,
 * FR-026, FR-027, FR-030). The single decision path: every permission
 * check anywhere in the platform is this guard reading metadata set by
 * `@RequirePermission` and asking `PermissionResolverService` — there is
 * no second way to gate an endpoint by permission.
 *
 * ## Deny by default
 *
 * Four ways a request can reach this guard, and what each one does:
 *
 *   1. `@Public()` on the handler or controller — the ONLY way to bypass
 *      BOTH this guard and `SessionGuard`. Reserved for routes that must
 *      work before authentication exists (login, health checks).
 *   2. `@RequirePermission(identifier)` present — the caller's effective
 *      permissions (via `PermissionResolverService`) must include
 *      `identifier`, or the request is refused.
 *   3. `@NoPermissionRequired()` present (T067, added when wiring
 *      `AuthController`) — an EXPLICIT, auditable opt-in for an endpoint
 *      that genuinely has no permission narrower than "is authenticated"
 *      (`GET /auth/me`, `GET /auth/session`, `POST /auth/logout`,
 *      `POST /auth/me/password` — auth.openapi.yaml: "no additional
 *      permission — a user may always read their own profile"). Unlike
 *      `@Public()`, this does NOT bypass `SessionGuard` (it carries no
 *      `@Public()` metadata) and still fails closed here with
 *      `UnauthorizedDomainError` if, somehow, no actor is resolved — the
 *      opt-out is narrowly scoped to "skip the PERMISSION check", never to
 *      "skip authentication".
 *   4. **None of the above** — refused. This is deliberate and is the
 *      mandatory "fail closed, always" working rule applied literally:
 *      `if (!required) return true;` would be a default that GRANTS
 *      access to an endpoint someone forgot to annotate, and the working
 *      rule for this task is "if you find yourself writing a default that
 *      grants, stop and invert it." An endpoint that is missing both
 *      `@RequirePermission` and the explicit `@NoPermissionRequired()` opt-in
 *      is a bug in that endpoint, not license to let it through.
 *
 * `PermissionGuard` is designed to be registered as a global guard
 * (`APP_GUARD`) once an authentication mechanism populates
 * `RequestContext.actorUserId` — ADR-003 describes it as "a global
 * `PermissionGuard`". It is NOT registered in `AppModule` by this task:
 * doing so today would refuse every existing route (including the health
 * checks), because no identity/session capability exists yet to resolve an
 * actor or to mark public routes. That wiring belongs to whichever task
 * introduces the authentication guard.
 *
 * ## Not disclosing resource existence (FR-030)
 *
 * Every denial this guard produces is `ForbiddenDomainError()` with its
 * generic default message, or `UnauthorizedDomainError()` when there is no
 * actor at all — never a message naming a specific record, a specific
 * missing permission's resource, or anything else that could tell a caller
 * whether some particular entity exists. This guard's decision depends only
 * on the caller's role-held permissions, never on any specific record, so
 * by construction it cannot leak a specific record's existence; the
 * repository-layer scope check (`ScopedRepository`, T040) is what is
 * responsible for existence non-disclosure on a per-record basis (typically
 * via `NotFoundDomainError`, per `shared/errors/domain-error.ts`).
 *
 * ## Composable with, but not a duplicate of, the organizational scope check
 *
 * This guard answers exactly one question: "does this caller's role set
 * include this permission identifier, at all, anywhere". It answers nothing
 * about *which* records the caller may see — that is `ScopeResolverService`
 * / `ScopedRepository`'s job (ADR-004), enforced in the repository layer,
 * not here. A controller action is therefore expected to be protected by
 * BOTH: `@RequirePermission('risk:edit')` at the boundary, and the
 * repository call inside the use case receiving a `ScopeFilter`. Neither
 * mechanism re-implements the other.
 *
 * ## The `DENIED` audit seam (FR-037)
 *
 * `PermissionDenialRecorderPort` is injected with `@Optional()` so this
 * file never had to change to light it up: `authorization.module.ts` now
 * binds it (T040a) to `AuditPermissionDenialRecorder`
 * (`core/authorization/infrastructure/audit-permission-denial-recorder.ts`),
 * which records a `DENIED` `audit_event` row via `AuditRecorder` for every
 * deny path below, in a dedicated short-lived transaction (see that
 * class's header for why). `@Optional()` remains — a test wiring this
 * guard without the binding still works exactly as before, with
 * `this.denialRecorder` simply `undefined` and every deny path skipping
 * the (no-op) call.
 */
import {
  Injectable,
  Optional,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY, Public } from '../../../shared/access/public.decorator';
import { ForbiddenDomainError, UnauthorizedDomainError } from '../../../shared/errors/domain-error';
import { PermissionResolverService } from '../application/permission-resolver.service';
import { CurrentActorPort } from '../domain/ports/current-actor.port';
import { PermissionDenialRecorderPort } from '../domain/ports/permission-denial-recorder.port';

import type { PermissionIdentifier } from '../domain/permissions';

export const REQUIRE_PERMISSION_KEY = 'pharos:requirePermission';
export const NO_PERMISSION_REQUIRED_KEY = 'pharos:noPermissionRequired';
// Re-exported for backward compatibility: `IS_PUBLIC_KEY`/`Public` now live
// in `shared/access/public.decorator.ts` (see that file's header for why —
// T064 needed a THIRD consumer, `HealthController`, a top-level
// `infrastructure` element that cannot import anything under `core/**`).
// Every existing import of `Public`/`IS_PUBLIC_KEY` from this file
// (`test/unit/permission.guard.spec.ts`, `authorization.module.ts`) keeps
// working unchanged.
export { IS_PUBLIC_KEY, Public };

/**
 * Declares the single permission identifier a handler (or every handler on
 * a controller) requires. `identifier` is typed `PermissionIdentifier` —
 * the compile-time union from `permissions.ts` — so a typo fails `tsc`
 * rather than silently never matching at runtime (ADR-003's stated
 * mitigation for `resource:action` strings not being database-checked).
 */
export const RequirePermission = (
  identifier: PermissionIdentifier,
): MethodDecorator & ClassDecorator => SetMetadata(REQUIRE_PERMISSION_KEY, identifier);

/**
 * Explicit opt-out of the PERMISSION check only (T067) — see this file's
 * header, point 3. An endpoint marked with this decorator still requires a
 * valid, resolved actor (`SessionGuard` must have run and succeeded); it
 * only means "any authenticated user may call this, there is no narrower
 * permission to check". Never combine with `@RequirePermission` on the
 * same target — if both are present, `@RequirePermission` wins (checked
 * first below).
 */
export const NoPermissionRequired = (): MethodDecorator & ClassDecorator =>
  SetMetadata(NO_PERMISSION_REQUIRED_KEY, true);

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionResolver: PermissionResolverService,
    private readonly currentActor: CurrentActorPort,
    @Optional() private readonly denialRecorder?: PermissionDenialRecorderPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic === true) {
      return true;
    }

    const requiredPermission = this.reflector.getAllAndOverride<PermissionIdentifier | undefined>(
      REQUIRE_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (requiredPermission === undefined) {
      const noPermissionRequired = this.reflector.getAllAndOverride<boolean | undefined>(
        NO_PERMISSION_REQUIRED_KEY,
        [context.getHandler(), context.getClass()],
      );

      if (noPermissionRequired !== true) {
        await this.deny({
          actorUserId: this.currentActor.getCurrentActorUserId(),
          requiredPermission: undefined,
          reason: 'MISSING_PERMISSION_DECLARATION',
        });
        throw new ForbiddenDomainError();
      }

      // @NoPermissionRequired(): still fails closed on "no actor" — only
      // the permission check itself is skipped (see this decorator's doc
      // comment above).
      if (this.currentActor.getCurrentActorUserId() === undefined) {
        await this.deny({
          actorUserId: undefined,
          requiredPermission: undefined,
          reason: 'NO_ACTOR',
        });
        throw new UnauthorizedDomainError();
      }
      return true;
    }

    const actorUserId = this.currentActor.getCurrentActorUserId();
    if (actorUserId === undefined) {
      await this.deny({
        actorUserId: undefined,
        requiredPermission,
        reason: 'NO_ACTOR',
      });
      throw new UnauthorizedDomainError();
    }

    const allowed = await this.permissionResolver.hasPermission(actorUserId, requiredPermission);
    if (!allowed) {
      await this.deny({
        actorUserId,
        requiredPermission,
        reason: 'PERMISSION_DENIED',
      });
      throw new ForbiddenDomainError();
    }

    return true;
  }

  private async deny(context: {
    actorUserId: string | undefined;
    requiredPermission: PermissionIdentifier | undefined;
    reason: 'MISSING_PERMISSION_DECLARATION' | 'NO_ACTOR' | 'PERMISSION_DENIED';
  }): Promise<void> {
    if (!this.denialRecorder) {
      return;
    }
    await this.denialRecorder.recordDenied(context);
  }
}
