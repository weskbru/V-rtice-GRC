/**
 * T191 — the attachable/commentable entity-type registry (FR-098, FR-030,
 * ADR-008, ADR-010, ADR-011). This is F-7's third missing extension point,
 * built for real: a future GRC module registers its own entity type here
 * and gets comments and attachments for free, without editing `core/**`.
 *
 * ## Why this lives in `core/comments`, and why `core/files` depends on it
 *
 * `core/comments`/`core/files` cannot depend on `modules/risk` (ADR-011:
 * "`core/**` must not import from `modules/**`"), yet FR-098 requires
 * EVERY comment and attachment read/write to be authorized against its
 * PARENT record's own permission and organizational scope — a check only
 * the module that OWNS that record type can perform. The registry pattern
 * already proven by `core/audit/domain/audit-field-allowlist.ts`
 * (`registerAuditFieldAllowlist`) solves the identical problem the
 * identical way: a plain, dependency-free registry that the OWNING module
 * populates from its own composition root at bootstrap, inverting the
 * dependency so `core/**` never has to know a business module exists.
 * (`core/authorization/domain/permissions.ts` used this same runtime
 * registration shape once too, but no longer does — A3 replaced it with
 * static, import-time aggregation because its consumers include a
 * standalone script that never constructs any Nest module; see that
 * file's own header for why this registry's consumers do not have that
 * constraint and a runtime registration call remains the right tool
 * here.)
 *
 * `core/files` (T188-T190) imports this file directly — a legitimate
 * cross-capability `core` import (ADR-011 restricts `core/**` -> `modules/
 * **`, not `core/**` -> `core/**`; `apps/api/eslint.config.mjs`'s own
 * comment: "Cross-capability core imports are not restricted"). The
 * registry itself stays framework-free (no NestJS decorator, no Prisma
 * import) so it is safely importable from any layer of either capability.
 *
 * ## What a future module concretely does (worked example)
 *
 * A hypothetical `modules/problems` module that wants comments and
 * attachments on its `Problem` entity:
 *
 * 1. Adds `PROBLEM` to `AttachableEntityType`/`CommentableEntityType` in
 *    `schema.prisma` via an additive `ALTER TYPE ... ADD VALUE` migration —
 *    exactly like `AuditEntityType`'s own growth (ADR-008: "closed platform
 *    enums grow by reviewed migration"). This is the one step that is not
 *    purely a code-level registration, because the entity-type value is a
 *    closed, database-enforced set — the SAME cost every other
 *    cross-cutting capability's entity types already pay (`RISK` itself
 *    needed one for `AuditEntityType`, `ApprovableEntityType`, and now
 *    these two).
 * 2. From its OWN composition root (`ProblemsModule`'s constructor, the
 *    exact spot `RiskModule`'s constructor calls
 *    `registerRiskAuditAllowlists()`), calls
 *    `registerCommentableEntityType('PROBLEM', accessor)` and/or
 *    `registerAttachableEntityType('PROBLEM', accessor)` — it may
 *    register for one capability without the other; nothing requires both.
 * 3. `accessor.resolveViewableParent(actorUserId, entityId)` is the
 *    module's OWN existing "can this actor view this record" logic —
 *    typically a thin wrapper around a use case the module already has
 *    (`RiskModule`'s registration below reuses `GetRiskUseCase` verbatim).
 *    It MUST throw `NotFoundDomainError` (never `ForbiddenDomainError`) for
 *    every reason the actor may not proceed — missing view permission, out
 *    of organizational scope, or the record genuinely does not exist — so
 *    all three are indistinguishable to the caller (FR-030). On success it
 *    returns the record's own organizational unit id, used only to
 *    populate the resulting audit entry's `organizationalUnitId` (FR-033).
 *
 * No edit to `core/comments/**`/`core/files/**` is needed for step 2-3 —
 * this file's registry is exactly the seam. `RiskModule` (T086-T092) is the
 * worked, exercised example of this: see `risk.module.ts`'s constructor.
 */
import type { AttachableEntityType, CommentableEntityType } from '@prisma/client';

/** Returned by a successful `resolveViewableParent` call. */
export interface ParentRecordAccess {
  /** The parent record's current organizational unit, for the audit
   * entry's `organizationalUnitId` (FR-033). `undefined` for a parent
   * entity type with no organizational scope of its own. */
  readonly organizationalUnitId: string | undefined;
}

/**
 * The contract a future module implements once per entity type it
 * registers. See this file's header for the full worked example.
 */
export interface ParentRecordAccessor {
  /**
   * Resolves whether `actorUserId` may currently view the parent record
   * `entityId`. MUST throw {@link NotFoundDomainError} — never
   * `ForbiddenDomainError` — when the actor lacks the record's own view
   * permission, the record lies outside the actor's organizational scope,
   * or the record does not exist: all three must be indistinguishable to
   * the caller (FR-030, FR-098).
   */
  resolveViewableParent(actorUserId: string, entityId: string): Promise<ParentRecordAccess>;
}

export class EntityTypeNotRegisteredError extends Error {
  constructor(capability: 'attachable' | 'commentable', entityType: string) {
    super(
      `No ${capability} entity-type accessor is registered for "${entityType}". Register one ` +
        `with register${capability === 'attachable' ? 'Attachable' : 'Commentable'}EntityType(...) ` +
        "from the owning module's own composition root (see core/comments/domain/entity-registry.ts).",
    );
    this.name = 'EntityTypeNotRegisteredError';
  }
}

const attachableRegistry = new Map<AttachableEntityType, ParentRecordAccessor>();
const commentableRegistry = new Map<CommentableEntityType, ParentRecordAccessor>();

/** Registers `accessor` for `entityType` in the attachable capability.
 * Throws if `entityType` is already registered — two modules disagreeing
 * about one entity type's accessor is a configuration bug, never resolved
 * by "last write wins" (same discipline as `registerAuditFieldAllowlist`). */
export function registerAttachableEntityType(
  entityType: AttachableEntityType,
  accessor: ParentRecordAccessor,
): void {
  if (attachableRegistry.has(entityType)) {
    throw new Error(
      `Attachable entity type "${entityType}" is already registered. Each entity type may be ` +
        'registered exactly once.',
    );
  }
  attachableRegistry.set(entityType, accessor);
}

/** Registers `accessor` for `entityType` in the commentable capability. */
export function registerCommentableEntityType(
  entityType: CommentableEntityType,
  accessor: ParentRecordAccessor,
): void {
  if (commentableRegistry.has(entityType)) {
    throw new Error(
      `Commentable entity type "${entityType}" is already registered. Each entity type may be ` +
        'registered exactly once.',
    );
  }
  commentableRegistry.set(entityType, accessor);
}

/** Looks up the registered accessor for `entityType`. Throws
 * {@link EntityTypeNotRegisteredError} rather than returning `undefined` —
 * an entity type that is a valid enum member but has no registered
 * accessor is a missing bootstrap registration (a programming error), not
 * a case to be silently treated as "always accessible" or "never
 * accessible". */
export function getAttachableEntityAccessor(
  entityType: AttachableEntityType,
): ParentRecordAccessor {
  const accessor = attachableRegistry.get(entityType);
  if (!accessor) {
    throw new EntityTypeNotRegisteredError('attachable', entityType);
  }
  return accessor;
}

/**
 * Returns whether `value` is CURRENTLY a registered attachable entity
 * type — read at CALL time from the live registry `Map`, never cached or
 * snapshotted. This is F-22 defect 1's fix: the HTTP-boundary DTOs
 * (`UploadAttachmentRequestDto`/`ListAttachmentsQueryDto`) used to
 * validate `entityType` with `@IsIn(['RISK'])`, a hand-maintained literal
 * evaluated once when the DTO file is first imported — before any
 * module's constructor has necessarily run, since Nest resolves imports
 * and instantiates providers on its own schedule. A registered-but-not-
 * `RISK` type (e.g. a future module's own entity type, or `PROBE_RECORD`
 * in a test) was rejected with a 400 the registry itself would have
 * happily authorized. Consulting this function from inside a
 * `class-validator` custom validator's `validate()` callback — which
 * `class-validator` invokes at REQUEST-validation time, always after Nest
 * has finished bootstrapping every module — closes that gap. See
 * `core/comments/presentation/dto/registered-entity-type.validator.ts`.
 */
export function isAttachableEntityTypeRegistered(value: unknown): value is AttachableEntityType {
  return typeof value === 'string' && attachableRegistry.has(value as AttachableEntityType);
}

/** Same as {@link isAttachableEntityTypeRegistered}, for the commentable
 * capability. */
export function isCommentableEntityTypeRegistered(value: unknown): value is CommentableEntityType {
  return typeof value === 'string' && commentableRegistry.has(value as CommentableEntityType);
}

export function getCommentableEntityAccessor(
  entityType: CommentableEntityType,
): ParentRecordAccessor {
  const accessor = commentableRegistry.get(entityType);
  if (!accessor) {
    throw new EntityTypeNotRegisteredError('commentable', entityType);
  }
  return accessor;
}

/** Test-only escape hatch, exactly like
 * `__resetAuditFieldAllowlistRegistryForTests` — clears both registries so
 * a unit test can exercise registration from a known-empty state. Never
 * called by application code. */
export function __resetEntityRegistryForTests(): void {
  attachableRegistry.clear();
  commentableRegistry.clear();
}
