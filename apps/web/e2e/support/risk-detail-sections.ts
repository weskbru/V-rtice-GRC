import { risks } from '../../src/lib/messages/risks';

import type { Locator, Page } from '@playwright/test';

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
  readonly leafLabel: string | null;
}

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

export function riskDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: risks.detail.groupsAriaLabel, exact: true });
}

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

export async function gotoRiskDetailSection(
  page: Page,
  riskDetailUrl: string,
  sectionId: RiskDetailSectionId,
): Promise<void> {
  const separator = riskDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${riskDetailUrl}${separator}section=${sectionId}`);
}

export function riskDetailSectionPanel(page: Page, sectionId: RiskDetailSectionId): Locator {
  const descriptor = RISK_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
