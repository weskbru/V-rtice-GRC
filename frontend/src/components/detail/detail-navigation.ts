import type { ReactNode } from 'react';

export interface DetailSection {
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  readonly visible?: boolean;
}

export interface DetailGroup {
  readonly id: string;
  readonly label: string;
  readonly sections: readonly DetailSection[];
}

export function visibleSections(group: DetailGroup): readonly DetailSection[] {
  return group.sections.filter((section) => section.visible !== false);
}

export function visibleGroups(groups: readonly DetailGroup[]): readonly DetailGroup[] {
  return groups.filter((group) => visibleSections(group).length > 0);
}

export interface ResolvedDetailSection {
  readonly groupId: string;
  readonly sectionId: string;
}

export function resolveActiveDetailSection(
  groups: readonly DetailGroup[],
  sectionParam: string | null,
): ResolvedDetailSection | null {
  const groupsVisible = visibleGroups(groups);
  if (groupsVisible.length === 0) {
    return null;
  }

  if (sectionParam) {
    for (const group of groupsVisible) {
      const sections = visibleSections(group);
      if (sections.some((section) => section.id === sectionParam)) {
        return { groupId: group.id, sectionId: sectionParam };
      }
    }
  }

  const firstGroup = groupsVisible[0]!;
  const firstSection = visibleSections(firstGroup)[0]!;
  return { groupId: firstGroup.id, sectionId: firstSection.id };
}

export function firstVisibleSectionOf(
  groups: readonly DetailGroup[],
  groupId: string,
): string | null {
  const group = groups.find((candidate) => candidate.id === groupId);
  if (!group) {
    return null;
  }
  return visibleSections(group)[0]?.id ?? null;
}

export function groupIdOfSection(
  groups: readonly DetailGroup[],
  sectionId: string,
): string | undefined {
  return groups.find((group) => visibleSections(group).some((section) => section.id === sectionId))
    ?.id;
}
