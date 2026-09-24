import { incidents } from '../../src/lib/messages/incidents';

import type { Locator, Page } from '@playwright/test';

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

export const INCIDENT_DETAIL_GROUPS: readonly {
  readonly id: IncidentDetailGroupId;
  readonly label: string;
}[] = [
  { id: 'overview', label: incidents.detail.groups.overview },
  { id: 'response', label: incidents.detail.groups.response },
  { id: 'relationships', label: incidents.detail.groups.relationships },
  { id: 'register', label: incidents.detail.groups.register },
];

export function incidentDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: incidents.detail.groupsAriaLabel, exact: true });
}

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

export async function gotoIncidentDetailSection(
  page: Page,
  incidentDetailUrl: string,
  sectionId: IncidentDetailSectionId,
): Promise<void> {
  const separator = incidentDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${incidentDetailUrl}${separator}section=${sectionId}`);
}

export function incidentDetailSectionPanel(
  page: Page,
  sectionId: IncidentDetailSectionId,
): Locator {
  const descriptor = INCIDENT_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
