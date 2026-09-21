import { describe, expect, it } from 'vitest';

import {
  areaForResource,
  filterPermissionsByQuery,
  groupPermissionsByArea,
  permissionMatchesQuery,
  permissionVerbLabel,
  resourceLabel,
} from './permission-grouping';

import type { Permission } from '../../types';

/**
 * Unit evidence for the area-based grouping helpers (roles screen
 * refinement). `groupPermissionsByResource` (the resource-only grouping) is
 * already covered by `role-permissions-summary.test.tsx`, which must keep
 * passing unchanged — this file only exercises the AREA vocabulary added on
 * top of it: `areaForResource`, `resourceLabel`, `permissionVerbLabel` and
 * `groupPermissionsByArea` itself.
 */

function permission(overrides: Partial<Permission> & Pick<Permission, 'identifier'>): Permission {
  const separator = overrides.identifier.indexOf(':');
  const resource = separator >= 0 ? overrides.identifier.slice(0, separator) : overrides.identifier;
  return {
    resource,
    action: 'VIEW',
    description: `Descrição de ${overrides.identifier}`,
    ...overrides,
  };
}

describe('areaForResource', () => {
  it('maps a known resource to its declared area', () => {
    expect(areaForResource('risk')).toBe('risk');
    expect(areaForResource('methodology')).toBe('risk');
    expect(areaForResource('audit-engagement')).toBe('audit');
    expect(areaForResource('finding')).toBe('audit');
    expect(areaForResource('evidence')).toBe('collaboration');
    expect(areaForResource('user')).toBe('administration');
  });

  it('falls an unknown resource back to "other" rather than hiding it', () => {
    expect(areaForResource('some-future-resource')).toBe('other');
  });
});

describe('resourceLabel', () => {
  it('returns the pt-BR label for a known resource', () => {
    expect(resourceLabel('risk')).toBe('Riscos');
    expect(resourceLabel('audit-engagement')).toBe('Engajamentos de auditoria');
  });

  it('falls an unknown resource back to its raw identifier, never hiding it', () => {
    expect(resourceLabel('some-future-resource')).toBe('some-future-resource');
  });
});

describe('permissionVerbLabel', () => {
  it('reads the verb from the identifier suffix, not from the coarser `action` category', () => {
    // `control:test` is typed with action ASSESS (there is no TEST value in
    // `PermissionAction`), yet its own verb reads "Testar", not "Avaliar" —
    // the identifier's own vocabulary always wins over the category.
    const testPermission = permission({
      identifier: 'control:test',
      resource: 'control',
      action: 'ASSESS',
    });
    expect(permissionVerbLabel(testPermission)).toBe('Testar');
  });

  it('falls back to the coarse `action` category when the identifier carries no verb suffix', () => {
    const noSuffix = permission({
      identifier: 'legacyidentifier',
      resource: 'other',
      action: 'VIEW',
    });
    expect(permissionVerbLabel(noSuffix)).toBe('Visualizar');
  });

  it('falls an unknown verb back to its own raw suffix, never hiding it', () => {
    const unknownVerb = permission({ identifier: 'risk:frobnicate', resource: 'risk' });
    expect(permissionVerbLabel(unknownVerb)).toBe('frobnicate');
  });
});

describe('groupPermissionsByArea', () => {
  it('orders areas by the fixed product order, regardless of the input order', () => {
    const permissions = [
      permission({ identifier: 'user:administer', resource: 'user' }), // administration
      permission({ identifier: 'risk:view', resource: 'risk' }), // risk
      permission({ identifier: 'finding:view', resource: 'finding' }), // audit
    ];

    const areas = groupPermissionsByArea(permissions);

    expect(areas.map((area) => area.area)).toEqual(['risk', 'audit', 'administration']);
  });

  it('keeps permissions in the catalogue own order within a resource, never re-sorting them', () => {
    const permissions = [
      permission({ identifier: 'risk:delete', resource: 'risk' }),
      permission({ identifier: 'risk:view', resource: 'risk' }),
      permission({ identifier: 'risk:create', resource: 'risk' }),
    ];

    const areas = groupPermissionsByArea(permissions);

    expect(areas[0]?.resources[0]?.permissions.map((p) => p.identifier)).toEqual([
      'risk:delete',
      'risk:view',
      'risk:create',
    ]);
  });

  it('orders resources within one area by the fixed product order, not alphabetically or by input order', () => {
    // Within the "audit" area, `audit-engagement` is declared before
    // `finding` in the product order — fed in reverse here to prove the
    // output order comes from the fixed table, not from input or alphabet
    // (alphabetically "finding" < "audit-engagement", the opposite result).
    const permissions = [
      permission({ identifier: 'finding:view', resource: 'finding' }),
      permission({ identifier: 'audit-engagement:scope', resource: 'audit-engagement' }),
    ];

    const areas = groupPermissionsByArea(permissions);
    const audit = areas.find((area) => area.area === 'audit');

    expect(audit?.resources.map((r) => r.resource)).toEqual(['audit-engagement', 'finding']);
  });

  it('groups an unrecognized resource under "other" with the pt-BR fallback label', () => {
    const permissions = [permission({ identifier: 'widget:view', resource: 'widget' })];

    const areas = groupPermissionsByArea(permissions);

    expect(areas).toHaveLength(1);
    expect(areas[0]?.area).toBe('other');
    expect(areas[0]?.label).toBe('Outras permissões');
    expect(areas[0]?.resources[0]?.resource).toBe('widget');
  });

  it('sums the permission count across every resource in the area', () => {
    const permissions = [
      permission({ identifier: 'finding:view', resource: 'finding' }),
      permission({ identifier: 'finding:remediate', resource: 'finding' }),
      permission({ identifier: 'audit-engagement:scope', resource: 'audit-engagement' }),
    ];

    const areas = groupPermissionsByArea(permissions);
    const audit = areas.find((area) => area.area === 'audit');

    expect(audit?.permissionCount).toBe(3);
  });
});

/**
 * Migrated coverage (removal discipline): `permission-checklist.test.tsx`
 * guarded five distinct search behaviours before `PermissionChecklist` was
 * retired with the create dialog it served. The predicate itself moved here
 * — where it is a pure function and can be asserted directly — and the
 * search box that drives it is exercised in `role-edit-fields.test.tsx`.
 *
 * The pt-BR half of the predicate is the part that matters: `control:test`
 * has `action = ASSESS` and an English description, so "Testar" appears
 * NOWHERE in its raw data. A search that only looked at the identifier and
 * the description would find nothing for a reader typing the word the
 * screen itself shows them.
 */
describe('permissionMatchesQuery — migrated from PermissionChecklist', () => {
  const risk = permission({ identifier: 'risk:view', resource: 'risk' });
  const controlTest = permission({
    identifier: 'control:test',
    resource: 'control',
    action: 'ASSESS',
    description: 'Test the operating effectiveness of a control.',
  });
  const finding = permission({ identifier: 'finding:view', resource: 'finding' });
  const catalogue = [risk, controlTest, finding];

  it('matches everything for a blank query, so callers need no special case', () => {
    expect(filterPermissionsByQuery(catalogue, '')).toEqual(catalogue);
    expect(filterPermissionsByQuery(catalogue, '   ')).toEqual(catalogue);
  });

  it('matches the raw identifier', () => {
    expect(filterPermissionsByQuery(catalogue, 'control:test')).toEqual([controlTest]);
  });

  it('matches the catalogue description, which is still English (F-63)', () => {
    expect(filterPermissionsByQuery(catalogue, 'effectiveness')).toEqual([controlTest]);
  });

  it('matches the pt-BR verb label, absent from the identifier and from the action', () => {
    // `control:test` is action ASSESS; "Testar" comes from the identifier's
    // own verb through the pt-BR catalogue, and is the word the screen shows.
    expect(controlTest.action).toBe('ASSESS');
    expect(filterPermissionsByQuery(catalogue, 'testar')).toEqual([controlTest]);
  });

  it('matches the pt-BR resource label', () => {
    expect(filterPermissionsByQuery(catalogue, 'Achados')).toEqual([finding]);
  });

  it('matches the pt-BR module label', () => {
    expect(filterPermissionsByQuery(catalogue, 'Auditoria e achados')).toEqual([finding]);
  });

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(permissionMatchesQuery(risk, '  RISK:VIEW  ')).toBe(true);
  });

  it('returns an empty list when nothing matches', () => {
    expect(filterPermissionsByQuery(catalogue, 'inexistente-xyz')).toEqual([]);
  });
});
