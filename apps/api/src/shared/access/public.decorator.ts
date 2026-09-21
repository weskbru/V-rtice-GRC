/**
 * `@Public()` (originally defined directly inside `PermissionGuard`,
 * T035). Relocated to `shared/**` while wiring the global authentication
 * guard (T064) because a THIRD consumer now needs it that the original
 * location could not legally reach under the ADR-011 boundary rules:
 *
 *   - `PermissionGuard` (`core/authorization/presentation`) — original
 *     consumer, unaffected (still imports/re-exports this from here).
 *   - `SessionGuard` (`core/sessions/presentation`) — needs the SAME
 *     metadata key so a route marked `@Public()` bypasses BOTH global
 *     guards, not just one. `core-presentation -> core-presentation` across
 *     capabilities is allowed, so this alone would not have forced a move.
 *   - `HealthController` (`infrastructure/health`, a TOP-LEVEL
 *     infrastructure element) — `/api/v1/health/*` must stay public once
 *     `SessionGuard` is registered globally (T064's explicit requirement).
 *     There is no boundary policy allowing `infrastructure -> core-*` at
 *     all (only `core-infrastructure|module-infrastructure -> infrastructure`
 *     is allowed, the reverse direction is not), so `HealthController`
 *     could never import a decorator defined inside `core/authorization/**`
 *     without either weakening the lint rule (forbidden by this task's
 *     working rules) or moving the decorator somewhere every element may
 *     import unconditionally — `shared/**` is exactly that place (every
 *     element may import `shared`; `shared` imports nothing internal).
 *
 * `@nestjs/common`'s `SetMetadata` is an external npm import, not a
 * `src/**` path, so it is unaffected by `boundaries/dependencies` (which
 * only classifies internal paths) — the same reasoning that already lets
 * `core/audit/domain/audit-event.types.ts` import `@prisma/client` types
 * from `shared`-adjacent code.
 */
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'pharos:isPublic';

/**
 * Explicitly exempts a handler (or every handler on a controller) from
 * every global guard that checks this key (`SessionGuard`, `PermissionGuard`).
 * Reserved for routes that must be reachable before authentication exists
 * (login, health checks). Never combine with `@RequirePermission` on the
 * same target; if both are present, `@Public()` wins.
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
