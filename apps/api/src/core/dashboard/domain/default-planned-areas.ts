/**
 * Default `plannedArea` registrations for domains that have no
 * `modules/**` tree of their own yet (`CLAUDE.md` §17's evolution order).
 * Deliberately the FIRST caller of `registerPlannedArea`, not a special
 * case of it — exactly the relationship
 * `core/audit/domain/core-entity-audit-allowlists.ts` has with
 * `registerAuditFieldAllowlist`: a future real module registers its OWN
 * planned area (or its own real card) from its OWN composition root,
 * without touching this file.
 *
 * Labels come from the centralized pt-BR catalog
 * (`shared/messages/user-messages.ts`, CLAUDE.md §11.1) — this file wires
 * WHICH keys exist and WHERE their label comes from; it never hardcodes
 * user-facing text itself.
 *
 * ## Empty, 2026-09-11 (008-incidents-problems, defect fix)
 *
 * `PROBLEMS` and `INCIDENTS` were this file's last two entries, and are
 * removed here for the exact reason `CONTROLS` was removed on 2026-09-11
 * (007-implementation-remediation, Front G, see git history on this file):
 * both are now real, shipped `modules/**` business modules
 * (`specs/008-incidents-problems/`), so announcing either here as
 * "planned" told a real user a capability already in production had not
 * been built yet. This phase's own screens correctly flipped their
 * `navigation-registry.ts` entries from `planned` to `implemented`
 * (spec.md FR-025); this registry was the one place that treatment missed.
 *
 * `registerDefaultPlannedAreas()` now registers nothing:
 * `GET /dashboard`'s `plannedAreas` is genuinely `[]` today
 * (`test/contract/dashboard.spec.ts` asserts this). The registry mechanism
 * itself (`planned-area-registry.ts`) is deliberately NOT removed by this
 * fix — whether an extension point with no current registrant still
 * counts as a real capability under CLAUDE.md §19.10 is a call for the
 * coordinator, not something to decide silently inside a defect fix. A
 * future domain that ships with no `modules/**` tree of its own yet would
 * call `registerPlannedArea` from here; a domain that ships as a real
 * module registers its own placeholder (or real card) from its own
 * composition root instead, exactly as this file's own header already
 * describes.
 */
let registered = false;

/**
 * Idempotent: safe to call more than once (e.g. if more than one test
 * harness or module path triggers it in the same process) — only the
 * first call has any effect, so a second call never hits
 * `registerPlannedArea`'s "already registered" guard. Same pattern as
 * `registerCoreEntityAuditAllowlists`/`registerRiskAuditAllowlists`.
 *
 * No default planned area remains to register — see this file's own
 * header. A future domain with no `modules/**` tree of its own yet would
 * import `registerPlannedArea` from `./planned-area-registry` here and
 * call it below.
 */
export function registerDefaultPlannedAreas(): void {
  if (registered) {
    return;
  }
  registered = true;

  // Intentionally empty — see this file's header, "Empty, 2026-09-11".
}
