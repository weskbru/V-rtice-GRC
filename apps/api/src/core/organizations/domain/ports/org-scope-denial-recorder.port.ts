/**
 * T040a — the organizational-scope half of FR-037's `DENIED`-audit
 * requirement ("record audit entries for operations that are refused on
 * authorization grounds where those refusals are security-relevant").
 *
 * ADR-004 places organizational-scope enforcement in the repository layer,
 * not in a controller-level guard (`PermissionGuard` answers a different
 * question entirely — "does this caller hold this permission at all" — see
 * that guard's file header). This port is the equivalent seam for the
 * scope side: `OrgScopeEnforcerService`
 * (`core/organizations/application/org-scope-enforcer.service.ts`) calls
 * it exactly once, at the point it has already decided a candidate
 * record's organizational unit falls outside the caller's resolved
 * `ScopeFilter`, immediately before raising the non-disclosing
 * `NotFoundDomainError` FR-030 requires (a scope refusal must never read
 * differently from "this does not exist").
 *
 * `AuditOrgScopeDenialRecorder`
 * (`core/organizations/infrastructure/audit-org-scope-denial-recorder.ts`)
 * is the only implementation, bound in `organizations.module.ts`. An
 * abstract class, not a TypeScript `interface`, for the same DI-token
 * reason as every other port in this codebase (see `CurrentActorPort` in
 * `core/authorization`).
 */
import type { AuditEntityType } from '@prisma/client';

export interface OrgScopeDenialContext {
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** The record's actual organizational unit, when known — `undefined`
   * only for the (currently unreachable, defensively handled) case of a
   * scoped record with no organizational unit at all. */
  readonly organizationalUnitId: string | undefined;
}

export abstract class OrgScopeDenialRecorderPort {
  abstract recordDenied(context: OrgScopeDenialContext): Promise<void>;
}
