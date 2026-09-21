/**
 * T029/002-shared-grc-foundation, US1 — the registry that lets
 * `grc/evidence` resolve an `EvidenceLink`'s subject (existence,
 * organizational scope, display label) BY `EvidenceSubjectType`, without
 * `grc/**` ever importing `modules/**` (ADR-016 forbids it) — the exact
 * "capacidade transversal se anexa a muitos tipos de sujeito -> registro
 * de tipo fechado" mechanism data-model.md §3/ADR-018/R-001 describe,
 * applied to the READ side of a link (the WRITE side — `subjectType`
 * itself — is already that mechanism; this is what makes "does this
 * subject actually exist, and is it in the actor's scope" answerable
 * without a foreign key).
 *
 * Modeled directly on `core/comments/domain/entity-registry.ts`
 * (`ParentRecordAccessor`/`registerAttachableEntityType`/
 * `getAttachableEntityAccessor`) — see that file's header for the full
 * worked example this one does not repeat. The two registries are
 * deliberately NOT unified into one: `AttachableEntityType`/
 * `CommentableEntityType` and `EvidenceSubjectType` are three separate
 * closed enums (a future module may register for one capability without
 * the others — that file's own header explains why), and this registry
 * additionally lives in `grc/shared` rather than `core/comments` because
 * `core/**` may never import `grc/**` (ADR-016) while `grc/**` may freely
 * import `core/**` — `EvidenceSubjectResolverPort` needs to be reachable
 * from `grc/evidence/application/**`, never the reverse.
 *
 * ## Who registers what (worked example)
 *
 * - `modules/risk` registers `RISK` and `RISK_TREATMENT_DECISION` from its
 *   OWN composition root (`RiskModule`'s constructor, T030, the exact spot
 *   `registerAttachableEntityType('RISK', ...)` already sits) — `grc/**`
 *   never imports `modules/risk` to make this work; the dependency points
 *   the other way, exactly like ADR-020's port-and-adapter shape.
 * - `FINDING` and `ACTION` are resolved INSIDE `grc` itself (`grc/finding`,
 *   `grc/action`, later agents' scope, US2/US3) — because both live in
 *   `grc/**` already, their own module's constructor may register directly
 *   without any cross-boundary adapter at all. This registry is what makes
 *   that possible without touching this file: `registerEvidenceSubjectResolver`
 *   is called from four different composition roots over the life of this
 *   feature, and none of the four ever edits this one.
 */
import type { EvidenceSubjectType } from '@prisma/client';

/** Returned by a successful `resolveViewableSubject` call. */
export interface EvidenceSubjectAccess {
  /** The subject's own organizational unit, for the resulting audit
   * entry's `organizationalUnitId` and for the link-creation scope check
   * (FR-031/FR-033). */
  readonly organizationalUnitId: string;
  /** Human-readable label for display (`EvidenceLink.subjectLabel`,
   * contracts/grc-foundation.openapi.yaml) — e.g. a risk's own `code` plus
   * `title`. Resolved here, not reconstructed by the presentation layer,
   * because only the owning module knows how to label its own record. */
  readonly label: string;
}

/**
 * The contract each subject type's owning module implements once
 * (`RiskEvidenceSubjectAccessor`, T030, is `RISK`'s and
 * `RISK_TREATMENT_DECISION`'s shared implementation).
 */
export interface EvidenceSubjectAccessor {
  /**
   * Resolves whether `actorUserId` may currently view the subject
   * `subjectId`. MUST throw {@link NotFoundDomainError} — never
   * `ForbiddenDomainError` — for every reason the actor may not proceed:
   * missing view permission on the subject's own type, out of the actor's
   * organizational scope, or the record genuinely does not exist. All
   * three must be indistinguishable to the caller (FR-030, FR-032, SC-005)
   * — the identical contract `ParentRecordAccessor.resolveViewableParent`
   * already establishes for attachments/comments.
   */
  resolveViewableSubject(actorUserId: string, subjectId: string): Promise<EvidenceSubjectAccess>;
}

export class EvidenceSubjectTypeNotRegisteredError extends Error {
  constructor(subjectType: string) {
    super(
      `No evidence-subject accessor is registered for "${subjectType}". Register one with ` +
        "registerEvidenceSubjectResolver(...) from the owning module's own composition root " +
        '(see grc/shared/domain/ports/evidence-subject-resolver.port.ts).',
    );
    this.name = 'EvidenceSubjectTypeNotRegisteredError';
  }
}

const registry = new Map<EvidenceSubjectType, EvidenceSubjectAccessor>();

/** Registers `accessor` for `subjectType`. Throws if `subjectType` is
 * already registered — two modules disagreeing about one subject type's
 * accessor is a configuration bug, never resolved by "last write wins"
 * (same discipline as `registerAttachableEntityType`). */
export function registerEvidenceSubjectResolver(
  subjectType: EvidenceSubjectType,
  accessor: EvidenceSubjectAccessor,
): void {
  if (registry.has(subjectType)) {
    throw new Error(
      `Evidence subject type "${subjectType}" is already registered. Each subject type may be ` +
        'registered exactly once.',
    );
  }
  registry.set(subjectType, accessor);
}

/** Looks up the registered accessor for `subjectType`. Throws
 * {@link EvidenceSubjectTypeNotRegisteredError} rather than returning
 * `undefined` — a subject type that is a valid enum member but has no
 * registered accessor is a missing bootstrap registration (a programming
 * error, e.g. `FINDING`/`ACTION` before their owning modules exist), not a
 * case to be silently treated as "always visible" or "never visible". */
export function getEvidenceSubjectAccessor(
  subjectType: EvidenceSubjectType,
): EvidenceSubjectAccessor {
  const accessor = registry.get(subjectType);
  if (!accessor) {
    throw new EvidenceSubjectTypeNotRegisteredError(subjectType);
  }
  return accessor;
}

/** Test-only escape hatch, exactly like
 * `__resetEntityRegistryForTests` — clears the registry so a unit test can
 * exercise registration from a known-empty state. Never called by
 * application code. */
export function __resetEvidenceSubjectRegistryForTests(): void {
  registry.clear();
}
