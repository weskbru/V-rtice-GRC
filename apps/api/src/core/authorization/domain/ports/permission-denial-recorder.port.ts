/**
 * Seam for FR-037 ("record audit entries for operations that are refused
 * on authorization grounds where those refusals are security-relevant") —
 * T035 left this port defined and called; T040a provides the
 * implementation that turns a denial into a `DENIED` `audit_event` row via
 * `AuditRecorder`:
 * `core/authorization/infrastructure/audit-permission-denial-recorder.ts`
 * (`AuditPermissionDenialRecorder`), bound in `authorization.module.ts` as
 * `{ provide: PermissionDenialRecorderPort, useClass:
 * AuditPermissionDenialRecorder }`. See that class's file header for why it
 * lives under `core/authorization/infrastructure` rather than
 * `core/audit/**` (ADR-011 layer placement) and for the transaction and
 * failure-handling decisions.
 *
 * `PermissionGuard` still injects this with `@Optional()` (see
 * permission.guard.ts) — a test or a future composition that does not bind
 * a provider still works, with `this.denialRecorder` simply `undefined`
 * and every deny path skipping the (no-op) call; permission decisions
 * themselves are never affected by whether an audit binding exists.
 *
 * An abstract class, not an `interface`, for the same DI-token reason as
 * every other port in this codebase (see `CurrentActorPort`).
 */

export type PermissionDenialReason =
  /** A route enforced by `PermissionGuard` declared no `@RequirePermission`
   * and was not marked `@Public()` — refused by the guard's fail-closed
   * default, never a decorator omission being treated as "allow". */
  | 'MISSING_PERMISSION_DECLARATION'
  /** No actor could be resolved for the request (unauthenticated). */
  | 'NO_ACTOR'
  /** The actor's effective permission set does not include the required
   * identifier. */
  | 'PERMISSION_DENIED';

export interface PermissionDenialContext {
  readonly actorUserId: string | undefined;
  readonly requiredPermission: string | undefined;
  readonly reason: PermissionDenialReason;
}

export abstract class PermissionDenialRecorderPort {
  abstract recordDenied(context: PermissionDenialContext): Promise<void>;
}
