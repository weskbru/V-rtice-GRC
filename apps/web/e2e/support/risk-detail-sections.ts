import { risks } from '../../src/lib/messages/risks';

import type { Locator, Page } from '@playwright/test';

/**
 * PharosGRC — E2E helper for the risk detail screen's two-level navigation
 * (016-risk-detail-experience §4.4).
 *
 * Before this phase, every risk-detail E2E spec reached a section with one
 * `page.getByRole('tab', { name: '<label>' }).click()` against a single flat
 * strip. The redesign regrouped those fourteen (now fifteen) sections under
 * FIVE top-level groups (`role="tab"` too), each with its own leaf-level
 * `role="tab"` strip — and Radix only mounts a group's own content (and
 * therefore its nested leaf tablist) once that group is the ACTIVE one, so a
 * one-click `getByRole('tab', { name: leafLabel })` can no longer resolve
 * unless the group happens to already be selected. This file is the ONE
 * place that knows "clicking a leaf means clicking its parent group first,
 * then the leaf" — every spec that needs to reach a section calls
 * `openRiskDetailSection` instead of encoding that two-step dance itself, so
 * the next structural change to this screen (a group renamed, a section
 * regrouped) is one file to update, not thirty-seven call sites again.
 *
 * ## Labels come from the SAME catalog the screen renders from
 *
 * `risks.detail.groups`/`risks.detail.sections` (`apps/web/src/lib/
 * messages/risks.ts`) are imported directly, exactly like `indicators.spec.ts`
 * already imports `../src/lib/messages/indicators` — a spec asserting
 * against a second, hand-typed copy of a label the product already centralizes
 * once (CLAUDE.md §11.1) is exactly the divergence that let two different
 * casings of "Causas e Consequências"/"Planos de Ação" coexist silently
 * between this suite and the real catalog before this phase (the accessibility
 * audit's `detailSections` array, fixed by this same change).
 *
 * ## The group -> leaf table below is NOT importable from production code
 *
 * `risk-detail-view.tsx` builds its `groups` array inline, mixing rendered
 * JSX content into the same structure that decides grouping — there is no
 * separate, side-effect-free module exporting "group X contains leaves
 * [Y, Z]" for this file to import instead of restating. If a future change
 * moves a leaf to a different group (as this very phase moved "Processos e
 * Ativos" out of "Controles"), THIS table must be updated to match — there is
 * no compiler error that will catch a drift, only a failing E2E spec. This
 * mirrors the exact caveat `docs/reviews/risk-detail-capability-inventory.md`
 * §7 already recorded about the old `detailSections` array before this phase.
 */
export type RiskDetailSectionId =
  | 'overview'
  | 'assessment'
  | 'causes-consequences'
  | 'treatment'
  | 'controls'
  | 'action-plans'
  | 'incidents'
  | 'problems'
  | 'processes-assets'
  | 'evidence'
  | 'findings'
  | 'history'
  | 'audit'
  | 'attachments'
  | 'comments';

export type RiskDetailGroupId = 'overview' | 'analysis' | 'response' | 'relationships' | 'register';

interface RiskDetailSectionDescriptor {
  readonly groupId: RiskDetailGroupId;
  readonly groupLabel: string;
  /**
   * `null` for `overview` — that group has exactly one leaf, so
   * `RiskDetailView` never mounts a nested `EntityTabs` for it at all
   * (`sectionsVisible.length > 1` in `risk-detail-view.tsx`) and the group's
   * own tabpanel IS the section's content, directly.
   */
  readonly leafLabel: string | null;
}

/**
 * Every leaf section this screen can show, in the SAME order
 * `risk-detail-view.tsx` builds its `groups` array — not load-bearing for any
 * assertion here, but kept in sync so a diff against that file stays easy to
 * eyeball.
 */
export const RISK_DETAIL_SECTIONS: Readonly<
  Record<RiskDetailSectionId, RiskDetailSectionDescriptor>
> = {
  overview: { groupId: 'overview', groupLabel: risks.detail.groups.overview, leafLabel: null },
  assessment: {
    groupId: 'analysis',
    groupLabel: risks.detail.groups.analysis,
    leafLabel: risks.detail.sections.assessment,
  },
  'causes-consequences': {
    groupId: 'analysis',
    groupLabel: risks.detail.groups.analysis,
    leafLabel: risks.detail.sections.causesConsequences,
  },
  treatment: {
    groupId: 'response',
    groupLabel: risks.detail.groups.response,
    leafLabel: risks.detail.sections.treatment,
  },
  controls: {
    groupId: 'response',
    groupLabel: risks.detail.groups.response,
    leafLabel: risks.detail.sections.controls,
  },
  'action-plans': {
    groupId: 'response',
    groupLabel: risks.detail.groups.response,
    leafLabel: risks.detail.sections.actionPlans,
  },
  incidents: {
    groupId: 'relationships',
    groupLabel: risks.detail.groups.relationships,
    leafLabel: risks.detail.sections.incidents,
  },
  problems: {
    groupId: 'relationships',
    groupLabel: risks.detail.groups.relationships,
    leafLabel: risks.detail.sections.problems,
  },
  'processes-assets': {
    groupId: 'relationships',
    groupLabel: risks.detail.groups.relationships,
    leafLabel: risks.detail.sections.processesAssets,
  },
  evidence: {
    groupId: 'relationships',
    groupLabel: risks.detail.groups.relationships,
    leafLabel: risks.detail.sections.evidence,
  },
  findings: {
    groupId: 'relationships',
    groupLabel: risks.detail.groups.relationships,
    leafLabel: risks.detail.sections.findings,
  },
  history: {
    groupId: 'register',
    groupLabel: risks.detail.groups.register,
    leafLabel: risks.detail.sections.history,
  },
  audit: {
    groupId: 'register',
    groupLabel: risks.detail.groups.register,
    leafLabel: risks.detail.sections.audit,
  },
  attachments: {
    groupId: 'register',
    groupLabel: risks.detail.groups.register,
    leafLabel: risks.detail.sections.attachments,
  },
  comments: {
    groupId: 'register',
    groupLabel: risks.detail.groups.register,
    leafLabel: risks.detail.sections.comments,
  },
};

/** The five top-level groups, in display order — for tests that iterate the whole navigation rather than one section. */
export const RISK_DETAIL_GROUPS: readonly {
  readonly id: RiskDetailGroupId;
  readonly label: string;
}[] = [
  { id: 'overview', label: risks.detail.groups.overview },
  { id: 'analysis', label: risks.detail.groups.analysis },
  { id: 'response', label: risks.detail.groups.response },
  { id: 'relationships', label: risks.detail.groups.relationships },
  { id: 'register', label: risks.detail.groups.register },
];

/**
 * The level-1 tablist — "Grupos de seções do risco" (`risks.detail.
 * groupsAriaLabel`). Scoped `exact: true` because the coordinator-measured
 * hazard is real: the contextual aside carries its own "Relacionamentos"
 * heading and relationship-link items with names that collide with this
 * tablist's own tabs if a caller queries by bare label on the whole page
 * instead of scoping to this tablist first.
 */
export function riskDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: risks.detail.groupsAriaLabel, exact: true });
}

/** The level-2 tablist for one group — "Seções de <group label>" (`risks.detail.sectionsAriaLabel`). `null` for `overview`, which has no nested tablist (see `RiskDetailSectionDescriptor.leafLabel`'s own doc comment). */
export function riskDetailLeafTablist(page: Page, groupId: RiskDetailGroupId): Locator | null {
  const groupLabel = RISK_DETAIL_GROUPS.find((group) => group.id === groupId)?.label;
  if (groupId === 'overview' || !groupLabel) {
    return null;
  }
  return page.getByRole('tablist', {
    name: risks.detail.sectionsAriaLabel(groupLabel),
    exact: true,
  });
}

/**
 * Opens a leaf section by clicking its parent group tab first (level 1),
 * then — for every group but `overview` — its own leaf tab (level 2). This
 * is the ONE mechanism every risk-detail spec should use to reach a section
 * through the UI; specs whose own subject is something OTHER than the
 * navigation itself may prefer `?section=<id>` directly (`gotoRiskDetailSection`
 * below) instead of paying for two clicks to get somewhere the test does not
 * actually care HOW it arrived.
 */
export async function openRiskDetailSection(
  page: Page,
  sectionId: RiskDetailSectionId,
): Promise<void> {
  const descriptor = RISK_DETAIL_SECTIONS[sectionId];
  await riskDetailGroupTablist(page)
    .getByRole('tab', { name: descriptor.groupLabel, exact: true })
    .click();

  if (descriptor.leafLabel === null) {
    return;
  }
  const leafTablist = riskDetailLeafTablist(page, descriptor.groupId);
  await leafTablist!.getByRole('tab', { name: descriptor.leafLabel, exact: true }).click();
}

/** Navigates directly to `<riskDetailUrl>?section=<id>` — the deep link (§4.4) — for a spec whose subject is the SECTION's own content, not the click path that reaches it. */
export async function gotoRiskDetailSection(
  page: Page,
  riskDetailUrl: string,
  sectionId: RiskDetailSectionId,
): Promise<void> {
  const separator = riskDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${riskDetailUrl}${separator}section=${sectionId}`);
}

/**
 * The section's own `role="tabpanel"`, scoped by its accessible name exactly
 * the way Radix names it (`aria-labelledby` the active trigger) — for
 * assertions that must not collide with same-named text elsewhere on the
 * page (the header's own "Inerente: …"/"Residual: …" badges, the aside's
 * relationship items, etc. — every existing risk-detail spec already scopes
 * this way for exactly that reason).
 */
export function riskDetailSectionPanel(page: Page, sectionId: RiskDetailSectionId): Locator {
  const descriptor = RISK_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
