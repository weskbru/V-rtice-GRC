import { describe, expect, it } from 'vitest';

import {
  firstVisibleSectionOf,
  groupIdOfSection,
  resolveActiveDetailSection,
  visibleGroups,
  visibleSections,
} from './detail-navigation';

import type { DetailGroup } from './detail-navigation';

function buildGroups(overrides?: { auditVisible?: boolean }): readonly DetailGroup[] {
  return [
    {
      id: 'overview',
      label: 'Visão geral',
      sections: [{ id: 'overview', label: 'Visão geral', content: null }],
    },
    {
      id: 'analysis',
      label: 'Análise',
      sections: [
        { id: 'assessment', label: 'Avaliação', content: null },
        { id: 'causes-consequences', label: 'Causas e Consequências', content: null },
      ],
    },
    {
      id: 'register',
      label: 'Registro',
      sections: [
        { id: 'history', label: 'Histórico', content: null },
        {
          id: 'audit',
          label: 'Auditoria',
          content: null,
          visible: overrides?.auditVisible ?? false,
        },
      ],
    },
  ];
}

describe('visibleSections / visibleGroups', () => {
  it('drops a section whose visible is false, never merely disabling it', () => {
    const groups = buildGroups({ auditVisible: false });
    const register = groups.find((group) => group.id === 'register')!;
    expect(visibleSections(register).map((section) => section.id)).toEqual(['history']);
  });

  it('keeps a group whose sections are ALL hidden out of the visible list entirely', () => {
    const groups: readonly DetailGroup[] = [
      {
        id: 'onlyHidden',
        label: 'Só oculto',
        sections: [{ id: 'x', label: 'X', content: null, visible: false }],
      },
      ...buildGroups(),
    ];
    expect(visibleGroups(groups).some((group) => group.id === 'onlyHidden')).toBe(false);
  });
});

describe('resolveActiveDetailSection', () => {
  it('resolves a known, visible section id straight through', () => {
    const groups = buildGroups();
    expect(resolveActiveDetailSection(groups, 'causes-consequences')).toEqual({
      groupId: 'analysis',
      sectionId: 'causes-consequences',
    });
  });

  it('falls back to the first visible group/section for an unknown id, without throwing', () => {
    const groups = buildGroups();
    expect(resolveActiveDetailSection(groups, 'does-not-exist')).toEqual({
      groupId: 'overview',
      sectionId: 'overview',
    });
  });

  it('falls back the same way for a section that exists but is not visible (a permission that came off) — FR-030', () => {
    const groups = buildGroups({ auditVisible: false });
    expect(resolveActiveDetailSection(groups, 'audit')).toEqual({
      groupId: 'overview',
      sectionId: 'overview',
    });
  });

  it('resolves the same "audit" id once the caller holds the permission that makes it visible', () => {
    const groups = buildGroups({ auditVisible: true });
    expect(resolveActiveDetailSection(groups, 'audit')).toEqual({
      groupId: 'register',
      sectionId: 'audit',
    });
  });

  it('falls back the same way for a null section param — the default landing state', () => {
    const groups = buildGroups();
    expect(resolveActiveDetailSection(groups, null)).toEqual({
      groupId: 'overview',
      sectionId: 'overview',
    });
  });
});

describe('firstVisibleSectionOf / groupIdOfSection', () => {
  it('finds the first visible leaf of a group, skipping a hidden earlier one', () => {
    const groups: readonly DetailGroup[] = [
      {
        id: 'g',
        label: 'G',
        sections: [
          { id: 'a', label: 'A', content: null, visible: false },
          { id: 'b', label: 'B', content: null },
        ],
      },
    ];
    expect(firstVisibleSectionOf(groups, 'g')).toBe('b');
  });

  it('returns null for a group id that does not exist', () => {
    expect(firstVisibleSectionOf(buildGroups(), 'nope')).toBeNull();
  });

  it('finds which group owns a given visible leaf section', () => {
    const groups = buildGroups();
    expect(groupIdOfSection(groups, 'assessment')).toBe('analysis');
  });

  it('does not attribute a hidden section to its group', () => {
    const groups = buildGroups({ auditVisible: false });
    expect(groupIdOfSection(groups, 'audit')).toBeUndefined();
  });
});
