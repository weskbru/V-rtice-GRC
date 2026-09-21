import { problems } from '../../src/lib/messages/problems';

import type { Locator, Page } from '@playwright/test';

/**
 * PharosGRC — E2E helper for the problem detail screen's two-level
 * navigation (019-problem-detail-experience, Fase A/E), mirroring
 * `incident-detail-sections.ts` exactly — see that file's own header
 * comment for the full reasoning this one does not repeat.
 *
 * Before this phase, every problem-detail E2E spec reached a section with
 * one `page.getByRole('tab', { name: '<label>' }).click()` against a single
 * flat strip of seven tabs. The redesign regrouped those seven sections
 * under FOUR top-level groups (`role="tab"` too), each with its own
 * leaf-level `role="tab"` strip for every group but "Visão geral" and
 * "Resposta" (single-leaf groups — Radix never mounts a nested tablist for
 * a group with only one section). This file is the ONE place that knows
 * "clicking a leaf means clicking its parent group first, then the leaf"
 * for Problems.
 *
 * ## The group -> leaf table below is NOT importable from production code
 *
 * `problem-detail-view.tsx` builds its `groups` array inline, exactly like
 * `incident-detail-view.tsx` does — there is no separate, side-effect-free
 * module this file could import instead of restating the same table. If a
 * future change moves a leaf to a different group, THIS table must be
 * updated to match — there is no compiler error that will catch a drift,
 * only a failing E2E spec (the same caveat `incident-detail-sections.ts`
 * documents for its own table).
 */
export type ProblemDetailSectionId =
  | 'overview'
  | 'corrective-actions'
  | 'risks'
  | 'incidents'
  | 'evidence'
  | 'attachments'
  | 'comments';

export type ProblemDetailGroupId = 'overview' | 'response' | 'relationships' | 'register';

interface ProblemDetailSectionDescriptor {
  readonly groupId: ProblemDetailGroupId;
  readonly groupLabel: string;
  /** `null` for a group with exactly one leaf ("Visão geral", "Resposta") — `ProblemDetailView` never mounts a nested `EntityTabs` for those, the group's own tabpanel IS the section's content directly. */
  readonly leafLabel: string | null;
}

export const PROBLEM_DETAIL_SECTIONS: Readonly<
  Record<ProblemDetailSectionId, ProblemDetailSectionDescriptor>
> = {
  overview: {
    groupId: 'overview',
    groupLabel: problems.detail.groups.overview,
    leafLabel: null,
  },
  'corrective-actions': {
    groupId: 'response',
    groupLabel: problems.detail.groups.response,
    leafLabel: null,
  },
  risks: {
    groupId: 'relationships',
    groupLabel: problems.detail.groups.relationships,
    leafLabel: problems.detail.sections.risks,
  },
  incidents: {
    groupId: 'relationships',
    groupLabel: problems.detail.groups.relationships,
    leafLabel: problems.detail.sections.incidents,
  },
  evidence: {
    groupId: 'register',
    groupLabel: problems.detail.groups.register,
    leafLabel: problems.detail.sections.evidence,
  },
  attachments: {
    groupId: 'register',
    groupLabel: problems.detail.groups.register,
    leafLabel: problems.detail.sections.attachments,
  },
  comments: {
    groupId: 'register',
    groupLabel: problems.detail.groups.register,
    leafLabel: problems.detail.sections.comments,
  },
};

/** The four top-level groups, in display order. */
export const PROBLEM_DETAIL_GROUPS: readonly {
  readonly id: ProblemDetailGroupId;
  readonly label: string;
}[] = [
  { id: 'overview', label: problems.detail.groups.overview },
  { id: 'response', label: problems.detail.groups.response },
  { id: 'relationships', label: problems.detail.groups.relationships },
  { id: 'register', label: problems.detail.groups.register },
];

/** The level-1 tablist — "Grupos de seções do problema" (`problems.detail.groupsAriaLabel`). Scoped `exact: true`: the contextual aside carries its own "Relacionamentos" heading and relationship-link items whose names would otherwise collide with this tablist's own tabs. */
export function problemDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: problems.detail.groupsAriaLabel, exact: true });
}

/** The level-2 tablist for one group — "Seções de <group label>". `null` for a single-leaf group (see `ProblemDetailSectionDescriptor.leafLabel`'s own doc comment). */
export function problemDetailLeafTablist(
  page: Page,
  groupId: ProblemDetailGroupId,
): Locator | null {
  const groupLabel = PROBLEM_DETAIL_GROUPS.find((group) => group.id === groupId)?.label;
  if (!groupLabel) {
    return null;
  }
  const hasLeaf = Object.values(PROBLEM_DETAIL_SECTIONS).some(
    (descriptor) => descriptor.groupId === groupId && descriptor.leafLabel !== null,
  );
  if (!hasLeaf) {
    return null;
  }
  return page.getByRole('tablist', {
    name: problems.detail.sectionsAriaLabel(groupLabel),
    exact: true,
  });
}

/** Opens a leaf section by clicking its parent group tab first (level 1), then — for a multi-leaf group — its own leaf tab (level 2). The ONE mechanism every problem-detail spec should use to reach a section through the UI. */
export async function openProblemDetailSection(
  page: Page,
  sectionId: ProblemDetailSectionId,
): Promise<void> {
  const descriptor = PROBLEM_DETAIL_SECTIONS[sectionId];
  await problemDetailGroupTablist(page)
    .getByRole('tab', { name: descriptor.groupLabel, exact: true })
    .click();

  if (descriptor.leafLabel === null) {
    return;
  }
  const leafTablist = problemDetailLeafTablist(page, descriptor.groupId);
  await leafTablist!.getByRole('tab', { name: descriptor.leafLabel, exact: true }).click();
}

/** Navigates directly to `<problemDetailUrl>?section=<id>` — the deep link — for a spec whose subject is the SECTION's own content, not the click path that reaches it. */
export async function gotoProblemDetailSection(
  page: Page,
  problemDetailUrl: string,
  sectionId: ProblemDetailSectionId,
): Promise<void> {
  const separator = problemDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${problemDetailUrl}${separator}section=${sectionId}`);
}

/** The section's own `role="tabpanel"`, scoped by its accessible name exactly the way Radix names it — for assertions that must not collide with same-named text elsewhere on the page (the aside's own relationship items, etc.). */
export function problemDetailSectionPanel(page: Page, sectionId: ProblemDetailSectionId): Locator {
  const descriptor = PROBLEM_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
