/**
 * 009-indicators-reports, Fase 2 (T014, data-model.md §8) + Fase 3 (T018/
 * T031, `createIndicatorDefinition`/`listIndicatorDefinitions`). `read`
 * foundation plus this phase's write side (`create`) and the paginated,
 * `isActive`-filterable form of `list` the HTTP contract actually declares
 * — the same iterative-construction shape `FrameworkRepositoryPort` went
 * through across its own module's phases.
 *
 * **No `ScopeFilter` anywhere in this file, deliberately.**
 * `IndicatorDefinition` is a shared, organization-wide catalog (research.md
 * D-8, data-model.md §1): "at most one definition per catalog key,
 * visible to any caller with `indicator:view`" — the same platform-wide-
 * catalog-gated-only-by-permission shape `FrameworkRepositoryPort`
 * (`modules/compliance/domain/ports/framework-repository.port.ts`) already
 * established, and that file's own header names the regression test this
 * shape guards against (`compliance-catalog-unscoped.spec.ts`). Adding a
 * scope parameter here would be inventing a filter the specification
 * explicitly decided this table does not have (data-model.md §8's own
 * table, first row) — do not "fix" that by adding one later without a
 * spec change.
 */
import type { IndicatorDefinitionRecord } from '../indicator-definition.entity';
import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export interface CreateIndicatorDefinitionInput {
  readonly code: string;
  readonly metricKey: IndicatorMetricKey;
  readonly name: string;
  readonly description: string;
  readonly ownerUserId: string;
  /** Invariant T1 (data-model.md §1) is enforced by the CALLER
   * (`CreateIndicatorDefinitionUseCase`) before this method is ever
   * invoked — this port simply persists whatever it is given, together or
   * neither. */
  readonly thresholdComparator: IndicatorThresholdComparator | null;
  readonly thresholdValue: number | null;
  readonly createdByUserId: string;
}

export interface IndicatorDefinitionListQuery {
  readonly page: number;
  readonly pageSize: number;
  /** `undefined` = no filter (every row, active and inactive alike). */
  readonly isActive: boolean | undefined;
}

export interface IndicatorDefinitionListPage {
  readonly items: readonly IndicatorDefinitionRecord[];
  readonly total: number;
}

/**
 * `PATCH /indicators/{definitionId}` (T068 prep, `updateIndicatorDefinition`).
 * `metricKey` deliberately has no place here — the contract's own
 * `UpdateIndicatorDefinitionRequest` schema does not declare it, and
 * `metricKey` is `UNIQUE`/immutable once created (this file's own header,
 * `create`'s own doc comment). Every other field an
 * `IndicatorDefinition` carries is editable. `thresholdComparator`/
 * `thresholdValue` are nullable here (unlike `CreateIndicatorDefinitionInput`,
 * where they are simply absent-or-present) because a PATCH can explicitly
 * CLEAR an existing threshold by sending `null` — Invariant T1 on the
 * FINAL, post-merge pair is enforced by the CALLER
 * (`UpdateIndicatorDefinitionUseCase`, via the same
 * `assertIndicatorThresholdInvariant` `CreateIndicatorDefinitionUseCase`
 * uses) before this method is ever invoked, exactly like `create`'s own
 * doc comment describes for its own two fields.
 */
export interface UpdateIndicatorDefinitionChanges {
  readonly name?: string;
  readonly description?: string;
  readonly ownerUserId?: string;
  readonly thresholdComparator?: IndicatorThresholdComparator | null;
  readonly thresholdValue?: number | null;
  readonly isActive?: boolean;
}

export abstract class IndicatorDefinitionRepositoryPort {
  /** `undefined` when no definition with this id exists — never filtered
   * by scope (research.md D-8). Consumed by `IndicatorParentRecordAccessor`
   * (T010) to resolve a comment's parent record. */
  abstract findById(id: string): Promise<IndicatorDefinitionRecord | undefined>;

  /** `undefined` when no `IndicatorDefinition` has been configured yet for
   * `metricKey` — data-model.md §1's own "a definition is optional
   * configuration for a key that is already queryable without it". */
  abstract findByMetricKey(
    metricKey: IndicatorMetricKey,
  ): Promise<IndicatorDefinitionRecord | undefined>;

  /** `GET /indicators` (data-model.md §8: scope predicate "nenhum —
   * definição é compartilhada"). Paginated and optionally filtered by
   * `isActive`, per `contracts/indicators.openapi.yaml`'s
   * `listIndicatorDefinitions` query parameters — no organizational-scope
   * predicate exists to apply, because the table has no such column. */
  abstract list(query: IndicatorDefinitionListQuery): Promise<IndicatorDefinitionListPage>;

  /** `POST /indicators` (T018). `code` is caller-supplied here — already
   * allocated by `EntityCodeGeneratorPort.nextCode('IND', year)` inside the
   * SAME transaction, mirroring every other GRC kernel/business-module
   * create path (e.g. `IncidentRepositoryPort.create`). Uniqueness of
   * `metricKey` is enforced by the CALLER's pre-check plus the schema's own
   * `@unique` constraint — this method does not re-check it. */
  abstract create(input: CreateIndicatorDefinitionInput): Promise<IndicatorDefinitionRecord>;

  /** `PATCH /indicators/{definitionId}` (T068 prep). `undefined` when no
   * `IndicatorDefinition` with this id exists — the CALLER
   * (`UpdateIndicatorDefinitionUseCase`) has already confirmed existence
   * via `findById` before calling this, so `undefined` here means a
   * genuine race (deleted between the two calls), never the ordinary "not
   * found" path — mirrors `AssetRepositoryPort.update`'s identical
   * contract. */
  abstract update(
    id: string,
    changes: UpdateIndicatorDefinitionChanges,
  ): Promise<IndicatorDefinitionRecord | undefined>;

  /** `GET /indicators/metric-keys` (`listIndicatorMetricKeys`, T068 prep)
   * — every `metricKey` that currently has a configured
   * `IndicatorDefinition`, used ONLY to compute each catalog entry's own
   * `hasDefinition` flag. Never filtered by scope (research.md D-8) — same
   * reasoning as `listAllIds` below. A `Set`, not a count or a boolean map,
   * because the caller needs O(1) membership per one of the eleven (or
   * more) closed catalog keys, not a per-key round trip. */
  abstract listConfiguredMetricKeys(): Promise<ReadonlySet<IndicatorMetricKey>>;

  /** 009-indicators-reports, Fase 6 (T044) —
   * `IndicatorActionOriginAccessor#listOriginIdsInScope`'s bulk, SCOPE-ONLY
   * listing (`ActionOriginAccessor`, `grc/shared/domain/ports/
   * action-origin-resolver.port.ts`). Returns EVERY `IndicatorDefinition`
   * id, unconditionally — this table has no unit column to filter by
   * (research.md D-8, this file's own header), so "every id currently in
   * scope" and "every id" are the same set for any caller, the literal
   * meaning of spec.md FR-021's "toda IndicatorDefinition [é] visível a
   * qualquer chamador com indicator:view". Deliberately takes no
   * `ScopeFilter`/`UnitScopeFilter` parameter, unlike every other origin
   * type's own `listIdsInScope` — there is nothing here for one to
   * restrict. */
  abstract listAllIds(): Promise<readonly string[]>;
}
