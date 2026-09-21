/**
 * PharosGRC — `Action` origin routing, shared by the "Planos de Ação" list
 * column (`my-actions-columns.tsx`) and the action detail page
 * (`action-detail-view.tsx`) — ONE function, not two independent copies of
 * the same decision (the coordinator's explicit instruction for this task).
 *
 * `ActionOriginType` has exactly five values (CLAUDE.md §19.3 — a closed
 * registry, never a generic `related_entity(type, id)`), and each one is
 * handled here as its own named case, confirmed against the real
 * `originId` semantics at each domain's own action-creation call site
 * rather than assumed:
 *
 * - `RISK_TREATMENT` -> `originId` IS the risk's own id (`risk-lifecycle
 *   -actions.tsx`'s treatment flow), and `/risks/{id}/page.tsx` reads that
 *   segment directly as the risk id. Links to `/risks/{originId}`.
 * - `INCIDENT` -> `originId` IS the incident's own id
 *   (`incident-corrective-actions.tsx`: `originType: 'INCIDENT', originId:
 *   incidentId`), and `/incidents/{id}/page.tsx` reads that segment
 *   directly as the incident id. Links to `/incidents/{originId}`.
 * - `PROBLEM` -> `originId` IS the problem's own id
 *   (`problem-corrective-actions.tsx`: `originType: 'PROBLEM', originId:
 *   problemId`), and `/problems/{id}/page.tsx` reads that segment directly
 *   as the problem id. Links to `/problems/{originId}`.
 * - `FINDING` -> no detail route exists for a bare finding id: a `Finding`
 *   lives inside its audit engagement (`/audits/[auditId]`), with no
 *   standalone `/findings/{id}` route to resolve an origin id against.
 *   Rendered as plain, unlinked text.
 * - `CONTROL_ASSESSMENT` -> `originId` is the ASSESSMENT's own id
 *   (`control-remediation-dialog.tsx`: `assessmentId`, never the control's
 *   id), and no assessment detail route exists either — linking it to
 *   `/controls/{originId}` would silently open the WRONG entity (a
 *   different control, or nothing). Rendered as plain, unlinked text.
 *
 * Never a guessed route, never a broken link — an origin type with no real
 * detail route renders as text, exactly like `my-actions-columns.tsx`
 * already did for `FINDING` before this file existed; this only adds
 * `INCIDENT`/`PROBLEM` (real routes, previously missing) and makes the
 * decision reusable from the detail page.
 */
import type { ActionOriginType } from './types';

const ORIGIN_HREF_BUILDER: Record<ActionOriginType, ((originId: string) => string) | null> = {
  RISK_TREATMENT: (originId) => `/risks/${originId}`,
  INCIDENT: (originId) => `/incidents/${originId}`,
  PROBLEM: (originId) => `/problems/${originId}`,
  FINDING: null,
  CONTROL_ASSESSMENT: null,
};

/**
 * The action origin's detail route, or `undefined` when this origin type
 * has no detail route of its own in this release (see this file's own
 * header for `FINDING`/`CONTROL_ASSESSMENT`). Callers render `undefined` as
 * plain text, never a link.
 */
export function actionOriginHref(
  originType: ActionOriginType,
  originId: string,
): string | undefined {
  const builder = ORIGIN_HREF_BUILDER[originType];
  return builder ? builder(originId) : undefined;
}
