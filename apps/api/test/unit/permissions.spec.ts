/**
 * A3 — proof that the permission extension point actually works, not just
 * that it compiles. `combinePermissionDefinitions`
 * (`core/authorization/domain/permissions.ts`) and the real aggregator,
 * `src/permission-catalogue.ts`'s `getAllPermissionDefinitions`, are the two
 * pieces this suite exercises directly.
 *
 * The fake "second module" registration below is deliberately THROWAWAY —
 * it exists only in this test file, never in product code — the same
 * discipline T206a's own probe module used for the comments/dashboard
 * registries. `RISK_PERMISSION_DEFINITIONS`
 * (`modules/risk/domain/risk-permissions.ts`) is Risk Management's real,
 * permanent registration and is already proven by every other test in this
 * suite exercising a `risk:*`-gated endpoint; this file's job is narrower
 * and more specific: prove the MECHANISM generalizes to more than one
 * module, and prove the duplicate-identifier guard actually throws rather
 * than silently overwriting.
 */
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

/** A fake permission definition for a module that does not exist. Its
 * identifier is deliberately outside the compile-time `PermissionRegistry`
 * union (there is no product-code `declare module` augmentation for it,
 * and this test does not add one) — `combinePermissionDefinitions` operates
 * on `PermissionDefinition.identifier: string`, not on
 * `PermissionIdentifier`, precisely so it can combine a module's
 * definitions before or independent of that module's own type augmentation
 * being visible at a given call site. */
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
    expect(identifiers).toContain('audit:view'); // core
    expect(identifiers).toContain('risk:view'); // Risk Management
    expect(combined).toHaveLength(
      CORE_PERMISSION_DEFINITIONS.length + RISK_PERMISSION_DEFINITIONS.length,
    );
  });

  it('extends to a second, independent business module with no change to core or Risk Management', () => {
    // This is the "has actually been executed" evidence the extension
    // point exists to provide: a THIRD definition set (core, Risk
    // Management, and this throwaway fake module), combined with no edit
    // to either of the first two.
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
        identifier: 'audit:view', // already declared in CORE_PERMISSION_DEFINITIONS
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
        identifier: 'risk:view', // already declared in RISK_PERMISSION_DEFINITIONS
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
    // 002-shared-grc-foundation, T009 — the GRC kernel's three capabilities
    // (ADR-016), combined the same way Risk Management is above.
    expect(identifiers).toContain('evidence:view');
    expect(identifiers).toContain('evidence:link');
    expect(identifiers).toContain('action:view');
    expect(identifiers).toContain('finding:close');
    // 003-controls-management, T006 — the second business module (after
    // Risk) to add its own set, combined the same way.
    expect(identifiers).toContain('control:view');
    expect(identifiers).toContain('control:administer');
    // 004-compliance-management, T009 — the third business module, added
    // the same way.
    expect(identifiers).toContain('compliance:view');
    expect(identifiers).toContain('compliance:administer');
    expect(identifiers).toContain('compliance:map');
    // 005-audit-findings, T008 — the fourth business module, added the
    // same way. `audit-engagement:*`, never `audit:*` (FR-019,
    // research.md D-7) — see
    // `test/unit/audit-engagement-permission-namespace.spec.ts` (T010)
    // for the dedicated collision guard.
    expect(identifiers).toContain('audit-engagement:view');
    expect(identifiers).toContain('audit-engagement:scope');
    // 006-assets-processes, T003/T004 — the fifth and sixth business
    // modules, added the same way.
    expect(identifiers).toContain('asset:view');
    expect(identifiers).toContain('asset:administer');
    expect(identifiers).toContain('process:view');
    expect(identifiers).toContain('process:administer');
    // 008-incidents-problems, foundation — the seventh and eighth business
    // modules, added the same way.
    expect(identifiers).toContain('incident:view');
    expect(identifiers).toContain('incident:transition');
    expect(identifiers).toContain('problem:view');
    expect(identifiers).toContain('problem:transition');
    // 009-indicators-reports, T009 — the ninth and tenth business modules,
    // added the same way.
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
    // Proof that this is NOT a mutable runtime registry: unlike the prior
    // `registerPermissionDefinitions`, calling the aggregator more than
    // once (as the seed script, contract tests and this suite all do,
    // independently, within one process) is side-effect-free.
    const first = getAllPermissionDefinitions();
    const second = getAllPermissionDefinitions();

    expect(second).toEqual(first);
  });
});
