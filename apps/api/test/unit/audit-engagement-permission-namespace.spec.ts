import { describe, expect, it } from 'vitest';

import {
  combinePermissionDefinitions,
  CORE_PERMISSION_DEFINITIONS,
  type PermissionDefinition,
} from '../../src/core/authorization/domain/permissions';
import { AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS } from '../../src/modules/audit-engagements/domain/audit-engagement-permissions';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

describe('audit-engagement:* permission namespace (FR-019, research.md D-7)', () => {
  it('every permission this module declares uses the audit-engagement resource, never audit', () => {
    for (const definition of AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS) {
      expect(definition.resource).toBe('audit-engagement');
      expect(definition.identifier.startsWith('audit-engagement:')).toBe(true);
      expect(definition.identifier.startsWith('audit:')).toBe(false);
    }
  });

  it("the CORE audit-trail permission (audit:view) and this module's five permissions coexist, distinct, in the real catalogue", () => {
    const identifiers = getAllPermissionDefinitions().map((definition) => definition.identifier);

    expect(identifiers).toContain('audit:view');
    expect(identifiers).toContain('audit-engagement:view');
    expect(identifiers).toContain('audit-engagement:create');
    expect(identifiers).toContain('audit-engagement:edit');
    expect(identifiers).toContain('audit-engagement:scope');
    expect(identifiers).toContain('audit-engagement:transition');

    expect(identifiers.filter((id) => id.startsWith('audit-engagement:'))).toHaveLength(5);
    expect(identifiers.filter((id) => id.startsWith('audit:'))).toHaveLength(1);
  });

  it('combinePermissionDefinitions throws if a future change ever reintroduces a real audit:* collision', () => {
    const collidingDefinition: PermissionDefinition = {
      identifier: 'audit:view',
      resource: 'audit',
      action: 'VIEW',
      description: 'Deliberately colliding fixture — never seeded, this test-only value only.',
    };

    expect(() =>
      combinePermissionDefinitions(CORE_PERMISSION_DEFINITIONS, [collidingDefinition]),
    ).toThrow(/already registered/i);
  });
});
