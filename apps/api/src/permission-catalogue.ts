/**
 * A3 remediation — the single permission-catalogue aggregator.
 *
 * `core/authorization/domain/permissions.ts` documents two extension
 * points a future module uses to add its own permissions: compile-time
 * `declare module` augmentation of `PermissionRegistry`, and a static
 * `PermissionDefinition[]` array combined here via
 * `combinePermissionDefinitions`. This file is where the combining
 * actually happens — core's own definitions plus every business module's,
 * computed once at import time, with no runtime registration call and no
 * import-order hazard.
 *
 * ## Why this file, and not `core/authorization/domain/permissions.ts`,
 * does the combining
 *
 * ADR-011 forbids `core/**` from importing `modules/**`
 * (`eslint-plugin-boundaries`, `apps/api/eslint.config.mjs`), and combining
 * every module's permissions necessarily means importing every module's own
 * permission-definitions file. This file sits at `src/` — outside both
 * `core/**` and `modules/**` — which `eslint.config.mjs`'s
 * `boundaries/elements` patterns do not classify into any element type, so
 * no `boundaries/dependencies` policy applies to it at all. That is not a
 * loophole; it is exactly where the platform's own composition root,
 * `src/app.module.ts`, already sits, importing both `core/**` modules and
 * `modules/risk/risk.module.ts` for the identical reason: something outside
 * every bounded domain has to be the one place that knows about all of
 * them.
 *
 * ## The two consumers this exists to serve identically
 *
 * - The Nest application: `RiskModule` (imported by `AppModule`) pulls in
 *   `modules/risk/domain/risk-permissions.ts` transitively, so its
 *   `declare module` augmentation is compiled into the program; this file's
 *   `getAllPermissionDefinitions()` is what `AdminPermissionsController`
 *   and the seed script both actually call.
 * - `apps/api/prisma/seed/platform.seed.ts`: a **standalone script**
 *   (`prisma/seed/index.ts` boots only `AppConfigModule`/`PrismaModule`,
 *   never `RiskModule`) that upserts every permission and validates every
 *   role's permission set. It imports this file directly — a plain,
 *   synchronous module import, evaluated once, regardless of whether any
 *   Nest module has ever been constructed. There is no ordering hazard to
 *   get right, because there is no runtime registration step to order.
 *
 * Add a future module's permissions here by adding one import and one
 * argument to `combinePermissionDefinitions` below — nothing else in this
 * file changes, and neither `core/**` nor the seed script needs to change
 * at all.
 */
import {
  combinePermissionDefinitions,
  CORE_PERMISSION_DEFINITIONS,
  type PermissionDefinition,
} from './core/authorization/domain/permissions';
import { ACTION_PERMISSION_DEFINITIONS } from './grc/action/domain/action-permissions';
import { EVIDENCE_PERMISSION_DEFINITIONS } from './grc/evidence/domain/evidence-permissions';
import { FINDING_PERMISSION_DEFINITIONS } from './grc/finding/domain/finding-permissions';
import { ASSET_PERMISSION_DEFINITIONS } from './modules/assets/domain/asset-permissions';
import { AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS } from './modules/audit-engagements/domain/audit-engagement-permissions';
import { COMPLIANCE_PERMISSION_DEFINITIONS } from './modules/compliance/compliance-permissions';
import { CONTROL_PERMISSION_DEFINITIONS } from './modules/controls/control-permissions';
import { INCIDENT_PERMISSION_DEFINITIONS } from './modules/incidents/domain/incident-permissions';
import { INDICATOR_PERMISSION_DEFINITIONS } from './modules/indicators/domain/indicator-permissions';
import { PROBLEM_PERMISSION_DEFINITIONS } from './modules/problems/domain/problem-permissions';
import { PROCESS_PERMISSION_DEFINITIONS } from './modules/processes/domain/process-permissions';
import { REPORT_PERMISSION_DEFINITIONS } from './modules/reports/domain/report-permissions';
import { RISK_PERMISSION_DEFINITIONS } from './modules/risk/domain/risk-permissions';

const ALL_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = combinePermissionDefinitions(
  CORE_PERMISSION_DEFINITIONS,
  RISK_PERMISSION_DEFINITIONS,
  // 002-shared-grc-foundation, T009 — one import and one argument per GRC
  // kernel capability (ADR-016). Nothing else in this file changes to add
  // one, exactly as this file's own header describes for a future module.
  EVIDENCE_PERMISSION_DEFINITIONS,
  ACTION_PERMISSION_DEFINITIONS,
  FINDING_PERMISSION_DEFINITIONS,
  // 003-controls-management, T006 — the second business module (after
  // Risk) to add its own set, the same one import/one argument shape.
  CONTROL_PERMISSION_DEFINITIONS,
  // 004-compliance-management, T009 — the third business module, same
  // one import/one argument shape.
  COMPLIANCE_PERMISSION_DEFINITIONS,
  // 005-audit-findings, T008 — the fourth business module, same one
  // import/one argument shape. `audit-engagement`, never `audit` (already
  // the CORE audit-trail permission's own resource, FR-019, research.md
  // D-7) — collision avoided by construction, guarded in code by
  // `test/unit/audit-engagement-permission-namespace.spec.ts` (T010).
  AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS,
  // 006-assets-processes, T003/T004 — the fifth and sixth business modules,
  // promoted from the two minimal registries `modules/risk`/
  // `modules/controls` used to read directly (data-model.md §5, research.md
  // D-7). Same one import/one argument shape as every prior addition above.
  ASSET_PERMISSION_DEFINITIONS,
  PROCESS_PERMISSION_DEFINITIONS,
  // 008-incidents-problems, foundation — the seventh and eighth business
  // modules. Same one import/one argument shape as every prior addition
  // above.
  INCIDENT_PERMISSION_DEFINITIONS,
  PROBLEM_PERMISSION_DEFINITIONS,
  // 009-indicators-reports, T009 — the ninth and tenth business modules.
  // Same one import/one argument shape as every prior addition above.
  INDICATOR_PERMISSION_DEFINITIONS,
  REPORT_PERMISSION_DEFINITIONS,
);

/** Every permission definition across the platform: core plus every
 * business module. Statically computed once, at import time — never used
 * for authorization decisions themselves (those check membership in a
 * user's resolved permission set, `permission-resolver.service.ts`, not
 * this catalogue); consumed by the seed script (T042) and by tests that
 * need the real, complete permission set. */
export function getAllPermissionDefinitions(): readonly PermissionDefinition[] {
  return ALL_PERMISSION_DEFINITIONS;
}
