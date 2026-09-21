/**
 * T040a — `OrgScopeEnforcerService`: the reusable point a future module's
 * application/repository layer calls, once it has a candidate record's
 * actual organizational unit in hand, to turn "is this in scope" into
 * either silent success or a non-disclosing refusal that is also audited
 * (FR-025c, FR-030, FR-037).
 *
 * ## Why this exists in Phase 2, with no business module consuming it yet
 *
 * ADR-004 places scope enforcement "in the repository layer... a future
 * module inherits the same enforcement by using the same base repository"
 * (`ScopedRepository`, `shared/persistence/scoped-repository.ts`).
 * `ScopedRepository` itself can only ever narrow a Prisma `where` clause —
 * it lives in `shared/**`, which under ADR-011 may not import from `core`,
 * so it structurally cannot depend on `AuditRecorder` to produce a
 * `DENIED` row. Recording that a *specific* out-of-scope access was
 * attempted (as opposed to a query simply returning zero rows, which is
 * indistinguishable from "nothing matches") requires knowing the
 * candidate's actual organizational unit — the caller (an application
 * service or a repository method sitting above the raw Prisma query) is
 * the first layer that has both that fact AND the resolved `ScopeFilter`
 * together. This service is that layer's single, reusable call site,
 * proven now against a fixture entity (see
 * `test/integration/audit-denied.spec.ts`) exactly as `PermissionGuard`
 * exercises `AuditPermissionDenialRecorder` — Risk Management (T101) is
 * the first *business* consumer, and will call this service the same way.
 *
 * ## F-38 — `assertExistingRecordAccessible`, the real business call site
 *
 * The paragraph above was, until F-38's fix, aspirational: `assertAccessible`
 * was proven only against a fixture entity — no `grc/**`/`modules/risk`
 * read, update, lifecycle-transition or relationship-creation use case
 * ever called it, so organizational-scope denials on an EXISTING record
 * were never audited in production, despite FR-030's own wording requiring
 * both permission and scope denials to be recorded (`docs/deferred-findings.md`
 * F-38). `assertExistingRecordAccessible` below is what closes that gap: it
 * is the actual method `GetRiskUseCase`/`UpdateRiskUseCase`/
 * `PerformTransitionUseCase`/the risk link use cases/`GetEvidenceUseCase`/
 * `UpdateEvidenceUseCase`/`ArchiveEvidenceUseCase`/`LinkEvidenceUseCase`/
 * `GetFindingUseCase`/`UpdateFindingUseCase`/`CloseFindingUseCase`/
 * `ReopenFindingUseCase`/`ArchiveFindingUseCase` now call at exactly the
 * point each used to throw a bare `NotFoundDomainError` on a scope-filtered
 * lookup miss (Action's own read/update/transition inherit this
 * transitively, through `GetRiskUseCase`, since `RiskActionOriginAccessor
 * .resolveOriginScope` is built on it). `assertAccessible` itself is
 * unchanged and remains the lower-level primitive both methods share.
 *
 * ## Non-disclosure (FR-030)
 *
 * `assertAccessible` throws `NotFoundDomainError` — never
 * `ForbiddenDomainError` — on refusal, exactly matching
 * `shared/errors/domain-error.ts`'s documented distinction: existence
 * itself is sensitive for an organizationally-scoped record, so "outside
 * your scope" and "does not exist" must read identically to the caller.
 * The `DENIED` audit row (recorded via `OrgScopeDenialRecorderPort` before
 * the throw) is where the real reason is preserved — for operators and
 * auditors, never for the HTTP response.
 */
import { Injectable } from '@nestjs/common';

import { NotFoundDomainError } from '../../../shared/errors/domain-error';
import { OrgScopeDenialRecorderPort } from '../domain/ports/org-scope-denial-recorder.port';

import type { ScopeFilter } from '../../../shared/persistence/scope-filter';
import type { AuditEntityType } from '@prisma/client';

export interface OrgScopeAccessCheck {
  readonly scope: ScopeFilter;
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  /** The candidate record's actual organizational unit. `undefined` is
   * treated as out of scope for a `UNIT` filter (a scoped entity with no
   * unit at all cannot be proven in-scope) but is always accessible under
   * a `GLOBAL` grant. */
  readonly organizationalUnitId: string | undefined;
}

/**
 * F-38 — the input `assertExistingRecordAccessible` takes. Distinct from
 * `OrgScopeAccessCheck` in exactly one way: `entityLabel`, a human-readable
 * pt-BR label (e.g. `'Risco'`, `'Evidência'`) for the `NotFoundDomainError`
 * message when the record turns out not to exist at all. That label is
 * NEVER part of the audited `DENIED` row (`OrgScopeDenialContext` carries
 * no free-text field at all — see that port's own doc comment) and exists
 * purely so the client-visible 404 stays byte-identical to whatever the
 * calling use case already threw before this method existed — using
 * `entityType` (an `AuditEntityType` like `'RISK'`) for that message, as
 * `assertAccessible` below does for its own, fixture-only caller, would
 * silently change every affected endpoint's response body.
 */
export interface ExistingRecordScopeCheck {
  readonly scope: ScopeFilter;
  readonly actorUserId: string | undefined;
  readonly entityType: AuditEntityType;
  readonly entityId: string;
  readonly entityLabel: string;
}

@Injectable()
export class OrgScopeEnforcerService {
  constructor(private readonly denialRecorder: OrgScopeDenialRecorderPort) {}

  /**
   * Resolves silently when `check.organizationalUnitId` is within
   * `check.scope`. Otherwise records a `DENIED` audit event and throws
   * `NotFoundDomainError` — callers must not catch this to substitute a
   * different, more revealing response (FR-030).
   */
  async assertAccessible(check: OrgScopeAccessCheck): Promise<void> {
    if (this.isWithinScope(check.scope, check.organizationalUnitId)) {
      return;
    }

    await this.denyAccess(check, check.entityType);
  }

  /**
   * F-38 — see this file's header. The shape every scoped read/update/
   * lifecycle-transition/relationship-creation use case repeats: its OWN
   * scoped lookup already returned nothing, and `resolveActualOrgUnit`
   * (an UNSCOPED lookup of the same record, e.g.
   * `RiskRepositoryPort.findOrgUnitIdUnscoped`) is the caller's answer to
   * "does it exist at all, and where" — paid only here, on this already-
   * exceptional refusal path (see `ScopedRepository
   * .resolveOrganizationalUnitIgnoringScope`'s doc comment for the cost
   * reasoning).
   *
   * - `undefined` (no row at all) → plain `NotFoundDomainError`, NO audit
   *   row. Auditing a genuinely missing id would make the audit trail
   *   itself the oracle that tells "missing" and "out of scope" apart —
   *   exactly what FR-030/SC-005 forbid the HTTP response from doing, so
   *   the audit trail must not do it either.
   * - a real org-unit id that is (still) within `check.scope` — a
   *   vanishingly narrow TOCTOU window where the record's unit moved INTO
   *   scope between the caller's own scoped lookup and this call — is
   *   treated the same as "not found": there is no fetched record to
   *   return, no denial to audit, and the caller may simply retry.
   * - a real org-unit id outside `check.scope` → the DENIED audit row is
   *   recorded (via `assertAccessible`'s own mechanism), then the
   *   IDENTICAL `NotFoundDomainError` is thrown.
   *
   * Always throws — typed `Promise<never>` so a call site can `return`
   * this call directly and let the compiler confirm nothing after it runs.
   */
  async assertExistingRecordAccessible(
    check: ExistingRecordScopeCheck,
    resolveActualOrgUnit: () => Promise<string | undefined>,
  ): Promise<never> {
    const organizationalUnitId = await resolveActualOrgUnit();

    if (
      organizationalUnitId === undefined ||
      this.isWithinScope(check.scope, organizationalUnitId)
    ) {
      throw new NotFoundDomainError(check.entityLabel, check.entityId);
    }

    return this.denyAccess(
      {
        scope: check.scope,
        actorUserId: check.actorUserId,
        entityType: check.entityType,
        entityId: check.entityId,
        organizationalUnitId,
      },
      check.entityLabel,
    );
  }

  private isWithinScope(scope: ScopeFilter, organizationalUnitId: string | undefined): boolean {
    if (scope.kind === 'GLOBAL') {
      return true;
    }
    return organizationalUnitId !== undefined && scope.unitIds.has(organizationalUnitId);
  }

  /** Records the `DENIED` audit row and throws the non-disclosing
   * `NotFoundDomainError` labeled `label` — shared by `assertAccessible`
   * (which always labels with `check.entityType`) and
   * `assertExistingRecordAccessible` (which labels with the caller's own
   * pt-BR `entityLabel`, to keep the client-visible message unchanged). */
  private async denyAccess(check: OrgScopeAccessCheck, label: string): Promise<never> {
    await this.denialRecorder.recordDenied({
      actorUserId: check.actorUserId,
      entityType: check.entityType,
      entityId: check.entityId,
      organizationalUnitId: check.organizationalUnitId,
    });

    throw new NotFoundDomainError(label, check.entityId);
  }
}
