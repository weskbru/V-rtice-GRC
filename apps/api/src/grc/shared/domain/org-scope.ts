/**
 * 002-shared-grc-foundation, US1 — the creation-time "is this organizational
 * unit within the caller's authorized scope" predicate (FR-003/FR-031),
 * shared verbatim by every `grc/**` capability's create use case. Mirrors
 * `modules/risk/application/create-risk.usecase.ts#isOrgUnitWithinScope`
 * exactly, factored out here (rather than duplicated three times across
 * `grc/evidence`/`grc/action`/`grc/finding`) because all three genuinely
 * need the IDENTICAL predicate against the SAME `ScopeFilter` type, with no
 * per-capability variation — unlike `EvidenceReferenceDataPort`'s
 * deliberate per-module duplication (see that file's header), there is no
 * coupling concern here to avoid: this is pure, dependency-free logic
 * operating only on `shared/persistence/scope-filter.ts`'s own type.
 *
 * Deliberately NOT `OrgScopeEnforcerService.assertAccessible`
 * (`core/organizations`), which throws `NotFoundDomainError` — correct for
 * reading/writing an EXISTING out-of-scope record (FR-030 non-disclosure) —
 * and, since F-38's fix, is exactly what `GetEvidenceUseCase`/
 * `UpdateEvidenceUseCase`/`ArchiveEvidenceUseCase`/`LinkEvidenceUseCase`
 * and their `grc/action`/`grc/finding` counterparts now do, via
 * `OrgScopeEnforcerService.assertExistingRecordAccessible` — but wrong at
 * creation time: there is no existing record whose existence could be
 * disclosed, so a use case creating a new `Evidence`/`Action`/`Finding`
 * outside the caller's scope reports `ValidationDomainError` (422) instead
 * — the caller is simply told their own scope does not reach where they
 * tried to create, the same reasoning `create-risk.usecase.ts`'s own copy
 * of this function documents.
 */
import type { ScopeFilter } from '../../../shared/persistence/scope-filter';

export function isOrgUnitWithinScope(scope: ScopeFilter, orgUnitId: string): boolean {
  return scope.kind === 'GLOBAL' || scope.unitIds.has(orgUnitId);
}
