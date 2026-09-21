/**
 * F-22 defect 2 fix — the dashboard's "planned area" registry (FR-050,
 * FR-051, SC-013, SC-011). Before this, `PlannedAreaKey` was a closed
 * TypeScript union (`'PROBLEMS' | 'INCIDENTS' | 'CONTROLS'`) and
 * `PLANNED_AREAS` a literal array, BOTH declared inside Risk Management's
 * own `modules/risk/application/get-dashboard.usecase.ts`. Contributing a
 * fourth planned area (or a real card once a module ships) meant editing
 * Risk Management, editing `shared/messages/user-messages.ts`, and
 * breaking a Risk Management contract test asserting the array had
 * exactly three known keys — exactly the "module number two costs a
 * fraction of module number one" promise SC-011 makes, broken.
 *
 * This mirrors the registry pattern already proven by
 * `core/comments/domain/entity-registry.ts`
 * (`registerAttachableEntityType`/`registerCommentableEntityType`): a
 * plain, dependency-free registry (no NestJS decorator, no Prisma import)
 * that the OWNING module populates from its OWN composition root, so the
 * consumer — `GetDashboardUseCase`, which stays in `modules/risk` for the
 * same reason `docs/local-environment.md`'s D-12 keeps the risk audit
 * controller there (see that use case's own header) — never has to know
 * which other modules exist. (`core/authorization/domain/permissions.ts`
 * used this same runtime-registration shape once too; A3 replaced it with
 * static, import-time aggregation for a reason specific to permissions —
 * a standalone seed script must see them with no Nest bootstrap — that
 * does not apply to this registry.)
 *
 * ## Why this lives in `core/dashboard`, not `modules/risk`
 *
 * "Which GRC modules are planned but not yet built" is platform-level
 * information, not a Risk Management concern — the same distinction
 * `core/authorization` already draws between the permission TYPE system
 * (platform, `core/`) and any one module's own permission SET
 * (`risk:view`, ..., owned by Risk Management). `modules/risk` may import
 * `core/dashboard` freely (`modules -> core` is an allowed dependency
 * direction under ADR-011/`eslint-plugin-boundaries`); `core/dashboard`
 * never imports `modules/risk` or anything else `modules/**` — this file
 * has zero imports of its own, exactly like `entity-registry.ts`.
 *
 * ## Who registers today's three entries
 *
 * `DashboardModule`'s own constructor calls `registerDefaultPlannedAreas()`
 * (`default-planned-areas.ts`, this directory) for PROBLEMS, INCIDENTS and
 * CONTROLS — the same reason `core/audit`'s `AuditModule` constructor
 * calls `registerCoreEntityAuditAllowlists()` for Core's OWN
 * `AuditEntityType` values: nobody else currently owns them, because
 * Problems/Incidents/Controls have no `modules/**` tree of their own yet
 * (`CLAUDE.md` §17's evolution order). The moment one of them gains a real
 * module, THAT module's own composition root registers its own planned
 * area (or, once it has real data, contributes its own dashboard card
 * through whatever mechanism replaces a "planned" placeholder) from its
 * own file — exactly mirroring how `RiskModule` registers `RISK`'s audit
 * allow-list and collaboration entity type from `modules/risk`, never from
 * `core/`. Nothing about this registry is Risk-Management-specific or
 * Problems/Incidents/Controls-specific; it is generic infrastructure a
 * probe module (T206a) or any future module can call directly.
 */

export interface PlannedAreaDefinition {
  readonly key: string;
  readonly label: string;
}

const plannedAreaRegistry = new Map<string, PlannedAreaDefinition>();

/** Registers one planned dashboard area. Throws on a duplicate `key` —
 * two registrants disagreeing about one planned area's label is a
 * configuration bug, never resolved by "last write wins" (same discipline
 * as `registerAttachableEntityType`/`registerCommentableEntityType`). */
export function registerPlannedArea(definition: PlannedAreaDefinition): void {
  if (plannedAreaRegistry.has(definition.key)) {
    throw new Error(
      `Planned dashboard area "${definition.key}" is already registered. Each key may be ` +
        'registered exactly once.',
    );
  }
  plannedAreaRegistry.set(definition.key, definition);
}

/** Returns every registered planned area. Order is registration order,
 * which is NOT part of the `/dashboard` contract — consumers must not
 * rely on it (the existing contract test sorts the keys before
 * asserting). */
export function getPlannedAreas(): readonly PlannedAreaDefinition[] {
  return Array.from(plannedAreaRegistry.values());
}

/** Test-only escape hatch, exactly like `__resetEntityRegistryForTests` —
 * clears the registry so a unit test can exercise registration from a
 * known-empty state. Never called by application code. */
export function __resetPlannedAreaRegistryForTests(): void {
  plannedAreaRegistry.clear();
}
