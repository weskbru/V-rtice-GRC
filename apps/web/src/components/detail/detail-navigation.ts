/**
 * PharosGRC — shared detail-screen navigation model, the two-level structure
 * originally built for risk detail (016-risk-detail-experience §4.4).
 *
 * Pure structure and resolution logic, no rendering: a detail view builds a
 * `DetailGroup[]` from the record it already loaded and the caller's
 * permissions, and this module answers "which group/section is active" from
 * that plus the `?section=` URL value — never the other way around. Section
 * visibility is by OMISSION (`visible: false` drops it from both levels),
 * never disabling (016 FR-030) — mirroring `EntityTabs`'s own contract
 * exactly, since that is what actually renders each level.
 *
 * ## Promotion (018-incident-detail-experience)
 *
 * Moved here, verbatim in behaviour, from
 * `features/risks/components/detail/risk-navigation.ts`
 * (`RiskDetailSection` → `DetailSection`, `RiskDetailGroup` → `DetailGroup`,
 * `ResolvedRiskDetailSection` → `ResolvedDetailSection`,
 * `resolveActiveRiskDetailSection` → `resolveActiveDetailSection`; the
 * already domain-neutral names — `visibleSections`, `visibleGroups`,
 * `firstVisibleSectionOf`, `groupIdOfSection` — are unchanged). This is a
 * rename and a move, not a rewrite: no logic changed.
 *
 * The promotion is earned, not speculative (CLAUDE.md §19.10 — a point of
 * extension only counts once exercised): Incidents' own detail screen
 * (018-incident-detail-experience) is the second real consumer, adopting the
 * exact same two-level shape Risks already proved in production. Consumers
 * today: `apps/web/src/app/(app)/risks/[id]/risk-detail-view.tsx` and the
 * incident detail view being built in this same round.
 */
import type { ReactNode } from 'react';

export interface DetailSection {
  /** Stable, technical id — also the `?section=` URL value (CLAUDE.md §11.1: a route/query identifier is a technical identifier, not user-facing text). */
  readonly id: string;
  readonly label: string;
  readonly content: ReactNode;
  /** Defaults to `true`. `false` omits the section from both navigation levels entirely — never rendered disabled (FR-030). */
  readonly visible?: boolean;
}

export interface DetailGroup {
  readonly id: string;
  readonly label: string;
  readonly sections: readonly DetailSection[];
}

/** A group's own visible leaf sections, in order. */
export function visibleSections(group: DetailGroup): readonly DetailSection[] {
  return group.sections.filter((section) => section.visible !== false);
}

/** Every group that has at least one visible section — a group left with none does not appear either (016 spec §4.4). */
export function visibleGroups(groups: readonly DetailGroup[]): readonly DetailGroup[] {
  return groups.filter((group) => visibleSections(group).length > 0);
}

export interface ResolvedDetailSection {
  readonly groupId: string;
  readonly sectionId: string;
}

/**
 * Resolves which group/section should be active, from the current
 * `?section=` value. A `sectionParam` that names a section which is absent
 * or not currently visible — a stale deep link, or a permission that came
 * off — falls back silently to the first visible group's first visible
 * section, exactly as 016 spec §4.4 requires ("cai na primeira seção visível
 * sem erro"). Returns `null` only when there is no visible section at all
 * (a caller with view permission on the record always has at least an
 * overview section, so this is a defensive case, not an expected one).
 */
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

/** The first visible leaf section id of `groupId` — used when the user picks a DIFFERENT top-level group, so the section state always names a leaf that actually belongs to the newly active group. `null` when the group is absent/has no visible section. */
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

/** The group id that owns a given (visible) leaf section id — `undefined` if none does. */
export function groupIdOfSection(
  groups: readonly DetailGroup[],
  sectionId: string,
): string | undefined {
  return groups.find((group) => visibleSections(group).some((section) => section.id === sectionId))
    ?.id;
}
