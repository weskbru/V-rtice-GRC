import { describe, expect, it } from 'vitest';

import {
  combinePermissionDefinitions,
  CORE_PERMISSION_DEFINITIONS,
  type PermissionDefinition,
} from '../../src/core/authorization/domain/permissions';
import { ACTION_PERMISSION_DEFINITIONS } from '../../src/grc/action/domain/action-permissions';
import { EVIDENCE_PERMISSION_DEFINITIONS } from '../../src/grc/evidence/domain/evidence-permissions';
import { FINDING_PERMISSION_DEFINITIONS } from '../../src/grc/finding/domain/finding-permissions';
import { ASSET_PERMISSION_DEFINITIONS } from '../../src/modules/assets/domain/asset-permissions';
import { AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS } from '../../src/modules/audit-engagements/domain/audit-engagement-permissions';
import { COMPLIANCE_PERMISSION_DEFINITIONS } from '../../src/modules/compliance/compliance-permissions';
import { CONTROL_PERMISSION_DEFINITIONS } from '../../src/modules/controls/control-permissions';
import { INCIDENT_PERMISSION_DEFINITIONS } from '../../src/modules/incidents/domain/incident-permissions';
import { INDICATOR_PERMISSION_DEFINITIONS } from '../../src/modules/indicators/domain/indicator-permissions';
import { PROBLEM_PERMISSION_DEFINITIONS } from '../../src/modules/problems/domain/problem-permissions';
import { PROCESS_PERMISSION_DEFINITIONS } from '../../src/modules/processes/domain/process-permissions';
import { REPORT_PERMISSION_DEFINITIONS } from '../../src/modules/reports/domain/report-permissions';
import { RISK_PERMISSION_DEFINITIONS } from '../../src/modules/risk/domain/risk-permissions';
import { getAllPermissionDefinitions } from '../../src/permission-catalogue';

const FAKE_MODULE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'problem:view',
    resource: 'problem',
    action: 'VIEW',
    description: 'Fixture-only permission for a fake second module (test-only, never seeded).',
  },
];

describe('combinePermissionDefinitions', () => {
  it('combines core and one real business module (Risk Management) into one set', () => {
    const combined = combinePermissionDefinitions(
      CORE_PERMISSION_DEFINITIONS,
      RISK_PERMISSION_DEFINITIONS,
    );

    const identifiers = combined.map((definition) => definition.identifier);
    expect(identifiers).toContain('audit:view');
    expect(identifiers).toContain('risk:view');
    expect(combined).toHaveLength(
      CORE_PERMISSION_DEFINITIONS.length + RISK_PERMISSION_DEFINITIONS.length,
    );
  });

  it('extends to a second, independent business module with no change to core or Risk Management', () => {
    const combined = combinePermissionDefinitions(
      CORE_PERMISSION_DEFINITIONS,
      RISK_PERMISSION_DEFINITIONS,
      FAKE_MODULE_PERMISSION_DEFINITIONS,
    );

    const fakeDefinition = combined.find((definition) => definition.identifier === 'problem:view');
    expect(fakeDefinition).toEqual(FAKE_MODULE_PERMISSION_DEFINITIONS[0]);
    expect(combined).toHaveLength(
      CORE_PERMISSION_DEFINITIONS.length +
        RISK_PERMISSION_DEFINITIONS.length +
        FAKE_MODULE_PERMISSION_DEFINITIONS.length,
    );
  });

  it('throws on a duplicate identifier across two sets, and registers nothing from the offending call', () => {
    const duplicateOfCore: readonly PermissionDefinition[] = [
      {
        identifier: 'audit:view',
        resource: 'audit',
        action: 'VIEW',
        description: 'A second, colliding definition for an identifier core already owns.',
      },
    ];

    expect(() =>
      combinePermissionDefinitions(CORE_PERMISSION_DEFINITIONS, duplicateOfCore),
    ).toThrow(/already registered/);
  });

  it('throws on a duplicate identifier between two business modules (not just core vs. a module)', () => {
    const duplicateOfRisk: readonly PermissionDefinition[] = [
      {
        identifier: 'risk:view',
        resource: 'risk',
        action: 'VIEW',
        description: 'A second module wrongly claiming an identifier Risk Management already owns.',
      },
    ];

    expect(() =>
      combinePermissionDefinitions(RISK_PERMISSION_DEFINITIONS, duplicateOfRisk),
    ).toThrow(/already registered/);
  });
});

describe('getAllPermissionDefinitions (the real, product aggregator)', () => {
  it('returns core plus every business module and GRC kernel capability, with no duplicate identifiers', () => {
    const all = getAllPermissionDefinitions();
    const identifiers = all.map((definition) => definition.identifier);

    expect(identifiers).toContain('audit:view');
    expect(identifiers).toContain('risk:view');
    expect(identifiers).toContain('risk:administer');
    expect(identifiers).toContain('evidence:view');
    expect(identifiers).toContain('evidence:link');
    expect(identifiers).toContain('action:view');
    expect(identifiers).toContain('finding:close');
    expect(identifiers).toContain('control:view');
    expect(identifiers).toContain('control:administer');
    expect(identifiers).toContain('compliance:view');
    expect(identifiers).toContain('compliance:administer');
    expect(identifiers).toContain('compliance:map');
    expect(identifiers).toContain('audit-engagement:view');
    expect(identifiers).toContain('audit-engagement:scope');
    expect(identifiers).toContain('asset:view');
    expect(identifiers).toContain('asset:administer');
    expect(identifiers).toContain('process:view');
    expect(identifiers).toContain('process:administer');
    expect(identifiers).toContain('incident:view');
    expect(identifiers).toContain('incident:transition');
    expect(identifiers).toContain('problem:view');
    expect(identifiers).toContain('problem:transition');
    expect(identifiers).toContain('indicator:view');
    expect(identifiers).toContain('indicator:create');
    expect(identifiers).toContain('indicator:edit');
    expect(identifiers).toContain('report:view');
    expect(identifiers).toContain('report:create');
    expect(identifiers).toContain('report:edit');
    expect(new Set(identifiers).size).toBe(identifiers.length);
    expect(all).toHaveLength(
      CORE_PERMISSION_DEFINITIONS.length +
        RISK_PERMISSION_DEFINITIONS.length +
        EVIDENCE_PERMISSION_DEFINITIONS.length +
        ACTION_PERMISSION_DEFINITIONS.length +
        FINDING_PERMISSION_DEFINITIONS.length +
        CONTROL_PERMISSION_DEFINITIONS.length +
        COMPLIANCE_PERMISSION_DEFINITIONS.length +
        AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS.length +
        ASSET_PERMISSION_DEFINITIONS.length +
        PROCESS_PERMISSION_DEFINITIONS.length +
        INCIDENT_PERMISSION_DEFINITIONS.length +
        PROBLEM_PERMISSION_DEFINITIONS.length +
        INDICATOR_PERMISSION_DEFINITIONS.length +
        REPORT_PERMISSION_DEFINITIONS.length,
    );
  });

  it('is computed statically — calling it repeatedly never throws and always returns the same set', () => {
    const first = getAllPermissionDefinitions();
    const second = getAllPermissionDefinitions();

    expect(second).toEqual(first);
  });
});
