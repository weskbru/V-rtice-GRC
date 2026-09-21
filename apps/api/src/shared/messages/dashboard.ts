/** GRC Dashboard (T197) — `Dashboard.plannedAreas[].label`
 * (`contracts/platform.openapi.yaml`'s `Dashboard` schema, FR-050,
 * SC-013): a label only, no metric, for a module not yet implemented.
 * Consumed by `core/dashboard/domain/default-planned-areas.ts` (F-22
 * defect 2) when it registers a default placeholder entry — a future
 * module with its own `modules/**` tree registers its OWN planned area
 * from its OWN file, and would add its own label to ITS OWN
 * `shared/messages/<module>.ts` (CLAUDE.md §11.1, F-23 #3), composed into
 * `USER_MESSAGES.dashboard.plannedAreaLabels` from `user-messages.ts` —
 * never edit Risk Management's file to do so.
 *
 * Empty, 2026-09-11 (008-incidents-problems, defect fix): `CONTROLS` was
 * orphaned here on 2026-09-11 (007-implementation-remediation, Front G)
 * when `default-planned-areas.ts` stopped registering it as planned but
 * this label survived; `PROBLEMS` and `INCIDENTS` are removed alongside it
 * now, for the identical reason — all three are real, shipped `modules/**`
 * business modules today, and `default-planned-areas.ts` registers none of
 * them any longer (see that file's own header). This object stays
 * declared, empty, as the landing spot for the next domain that ships with
 * no `modules/**` tree of its own yet. */
export const dashboard = {
  plannedAreaLabels: {},
} as const;
