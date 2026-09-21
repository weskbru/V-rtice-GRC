/**
 * 008-incidents-problems, foundation — the minimal, scope-checked read
 * `modules/problems`'s own `application` layer needs before a real
 * repository exists (Fase 4, tasks.md's own scope). Mirrors
 * `modules/controls/domain/ports/control-lookup.port.ts`'s shape, reduced
 * to the one method this foundation pass's own consumer
 * (`ProblemEvidenceSubjectAccessor`) actually calls — `findOrgUnitIdUnscoped`
 * and the full F-38 non-disclosure pattern arrive with Fase 4's real
 * `GetProblemUseCase`, not invented ahead of a second consumer that would
 * need them (§19.10).
 *
 * `infrastructure/problem-lookup.repository.ts` is the only implementation.
 *
 * `listIdsInScope` was added alongside `ProblemActionOriginAccessor`
 * (spec.md FR-016, research.md D-2) — the bulk, scope-only listing
 * `ActionOriginAccessor.listOriginIdsInScope` requires
 * (`action-origin-resolver.port.ts`). Mirrors `RiskRepositoryPort
 * .listIdsInScope`'s own contract exactly.
 */
import type { ScopeFilter, UnitScopeFilter } from '../../../../shared/persistence/scope-filter';

export interface ProblemLookupRecord {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly orgUnitId: string;
}

export abstract class ProblemLookupPort {
  /** `undefined` when the problem does not exist OR exists outside
   * `scope` — the two are indistinguishable by design (spec.md FR-014
   * applied to Problem, mirroring `ControlLookupPort.findScoped`). */
  abstract findScoped(scope: ScopeFilter, id: string): Promise<ProblemLookupRecord | undefined>;

  /** Every problem id whose CURRENT `orgUnitId` is included in
   * `scope.unitIds` — a single query, never one call per candidate id. */
  abstract listIdsInScope(scope: UnitScopeFilter): Promise<readonly string[]>;
}
