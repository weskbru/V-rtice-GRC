import { problems } from '../../src/lib/messages/problems';

import type { Locator, Page } from '@playwright/test';

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

export const PROBLEM_DETAIL_GROUPS: readonly {
  readonly id: ProblemDetailGroupId;
  readonly label: string;
}[] = [
  { id: 'overview', label: problems.detail.groups.overview },
  { id: 'response', label: problems.detail.groups.response },
  { id: 'relationships', label: problems.detail.groups.relationships },
  { id: 'register', label: problems.detail.groups.register },
];

export function problemDetailGroupTablist(page: Page): Locator {
  return page.getByRole('tablist', { name: problems.detail.groupsAriaLabel, exact: true });
}

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

export async function gotoProblemDetailSection(
  page: Page,
  problemDetailUrl: string,
  sectionId: ProblemDetailSectionId,
): Promise<void> {
  const separator = problemDetailUrl.includes('?') ? '&' : '?';
  await page.goto(`${problemDetailUrl}${separator}section=${sectionId}`);
}

export function problemDetailSectionPanel(page: Page, sectionId: ProblemDetailSectionId): Locator {
  const descriptor = PROBLEM_DETAIL_SECTIONS[sectionId];
  const name = descriptor.leafLabel ?? descriptor.groupLabel;
  return page.getByRole('tabpanel', { name, exact: true });
}
