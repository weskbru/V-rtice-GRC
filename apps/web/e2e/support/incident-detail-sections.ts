import { incidents } from '../../src/lib/messages/incidents';

import type { Locator, Page } from '@playwright/test';

/**
 * PharosGRC — E2E helper for the incident detail screen's two-level
 * navigation (018-incident-detail-experience, Fase 2+3/Fase 6), mirroring
 * `risk-detail-sections.ts` exactly — see that file's own header comment
 * for the full reasoning this one does not repeat.
 *
 * Before this phase, every incident-detail E2E spec reached a section with
 * one `page.getByRole('tab', { name: '<label>' }).click()` against a single
 * flat strip of nine tabs. The redesign regrouped those nine sections under
 * FOUR top-level groups (`role="tab"` too), each with its own leaf-level
 * `role="tab"` strip for every group but "Visão geral" and "Resposta"
 * (single-leaf groups, exactly like Risk's own "Visão geral" — Radix never
 * mounts a nested tablist for a group with only one section). This file is
 * the ONE place that knows "clicking a leaf means clicking its parent group
 * first, then the leaf" for Incidents.
 *
 * ## The group -> leaf table below is NOT importable from production code
 *
 * `incident-detail-view.tsx` builds its `groups` array inline, exactly like
 * `risk-detail-view.tsx` does — there is no separate, side-effect-free
 * module this file could import instead of restating the same table. If a
 * future change moves a leaf to a different group, THIS table must be
 * updated to match — there is no compiler error that will catch a drift,
 * only a failing E2E spec (the same caveat `risk-detail-sections.ts`
 * documents for its own table).
 */
export type IncidentDetailSectionId =
  | 'overview'
  | 'corrective-actions'
  | 'risks'
  | 'assets'
  | 'processes'
  | 'problems'
  | 'evidence'
  | 'attachments'
  | 'comments';

export type IncidentDetailGroupId = 'overview' | 'response' | 'relationships' | 'register';

interface IncidentDetailSectionDescriptor {
  readonly groupId: IncidentDetailGroupId;
  readonly groupLabel: string;
  /** `null` for a group with exactly one leaf ("Visão geral", "Resposta") — `IncidentDetailView` never mounts a nested `EntityTabs` for those, the group's own tabpanel IS the section's content directly. */
  readonly leafLabel: string | null;
}

export const INCIDENT_DETAIL_SECTIONS: Readonly<
  Record<IncidentDetailSectionId, IncidentDetailSectionDescriptor>
> = {
  overview: {
    groupId: 'overview',
    groupLabel: incidents.detail.groups.overview,
    leafLabel: null,
  },
  'corrective-actions': {
    groupId: 'response',
    groupLabel: incidents.detail.groups.response,
    leafLabel: null,
  },
  risks: {
    groupId: 'relationships',
    groupLabel: incidents.detail.groups.relationships,
    leafLabel: incidents.detail.sections.risks,
  },
  assets: {
    groupId: 'relationships',
    groupLabel: incidents.detail.groups.relationships,
    leafLabel: incidents.detail.sections.assets,
  },
  processes: {
    groupId: 'relationships',
    groupLabel: incidents.detail.groups.relationships,
    leafLabel: incidents.detail.sections.processes,
  },
  problems: {
    groupId: 'relationships',
    groupLabel: incidents.detail.groups.relationships,
    leafLabel: incidents.detail.sections.problems,
  },
  evidence: {
    groupId: 'register',
    groupLabel: incidents.detail.groups.register,
    leafLabel: incidents.detail.sections.evidence,
  },
  attachments: {
    groupId: 'register',
    groupLabel: incidents.detail.groups.register,
    leafLabel: incidents.detail.sections.attachments,
  },
  comments: {
    groupId: 'register',
    groupLabel: incidents.detail.groups.register,
    leafLabel: incidents.detail.sections.comments,
  },
};

/** The four top-level groups, in display order. */
export const INCIDENT_DETAIL_GROUPS: readonly {
  readonly id: IncidentDetailGroupId;
  readonly label: string;
}[] = [
  { id: 'overview', label: incidents.detail.groups.overview },
  { id: 'response', label: incidents.detail.groups.response },
  { id: 'relationships', label: incidents.detail.groups.relationships },
  { id: 'register', label: incidents.detail.groups.register },
];

/** The level-1 tablist — "Grupos de seções do incidente" (`incidents.detail.groupsAriaLabel`). Scoped `exact: true`: the contextual aside carries its own "Relacionamentos" heading and relationship-link items whose names would otherwise collide with this tablist's own tabs. */
export function incidentDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: incidents.detail.groupsAriaLabel, exact: true });
}

/** The level-2 tablist for one group — "Seções de <group label>". `null` for a single-leaf group (see `IncidentDetailSectionDescriptor.leafLabel`'s own doc comment). */
export function incidentDetailLeafTablist(
  page: Page,
  groupId: IncidentDetailGroupId,
): Locator | null {
  const groupLabel = INCIDENT_DETAIL_GROUPS.find((group) => group.id === groupId)?.label;
  if (!groupLabel) {
    return null;
  }
  const hasLeaf = Object.values(INCIDENT_DETAIL_SECTIONS).some(
    (descriptor) => descriptor.groupId === groupId && descriptor.leafLabel !== null,
  );
  if (!hasLeaf) {
    return null;
  }
  return page.getByRole('tablist', {
    name: incidents.detail.sectionsAriaLabel(groupLabel),
    exact: true,
  });
}

/** Opens a leaf section by clicking its parent group tab first (level 1), then — for a multi-leaf group — its own leaf tab (level 2). The ONE mechanism every incident-detail spec should use to reach a section through the UI. */
export async function openIncidentDetailSection(
  page: Page,
  sectionId: IncidentDetailSectionId,
): Promise<void> {
  const descriptor = INCIDENT_DETAIL_SECTIONS[sectionId];
  await incidentDetailGroupTablist(page)
    .getByRole('tab', { name: descriptor.groupLabel, exact: true })
    .click();

  if (descriptor.leafLabel === null) {
    return;
  }
  const leafTablist = incidentDetailLeafTablist(page, descriptor.groupId);
  await leafTablist!.getByRole('tab', { name: descriptor.leafLabel, exact: true }).click();
}

/** Navigates directly to `<incidentDetailUrl>?section=<id>` — the deep link — for a spec whose subject is the SECTION's own content, not the click path that reaches it. */
export async function gotoIncidentDetailSection(
  page: Page,
  incidentDetailUrl: string,
  sectionId: IncidentDetailSectionId,
): Promise<void> {
  const separator = incidentDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${incidentDetailUrl}${separator}section=${sectionId}`);
}

/** The section's own `role="tabpanel"`, scoped by its accessible name exactly the way Radix names it — for assertions that must not collide with same-named text elsewhere on the page (the aside's own relationship items, etc.). */
export function incidentDetailSectionPanel(
  page: Page,
  sectionId: IncidentDetailSectionId,
): Locator {
  const descriptor = INCIDENT_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
