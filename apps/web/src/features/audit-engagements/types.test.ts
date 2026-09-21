import { describe, expect, it } from 'vitest';

import type { OrgUnitRef, VersionConflictProblem } from './types';

/**
 * Compile-time regression tests locking two shapes this module's contract
 * (audit.openapi.yaml) declares differently from sibling modules — the same
 * class of defect `features/findings/types.test.ts`'s own `OrgUnitRef` test
 * guards against (assurance-audit Fix 3): a hand-written type silently
 * borrowing a DIFFERENT module's shape for a schema name that recurs across
 * this codebase's several OpenAPI documents.
 */
describe('OrgUnitRef (audit.openapi.yaml)', () => {
  it('is exactly {id, name} — no `code`, unlike the RISKS-domain OrgUnitRef', () => {
    const value: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` is the RISKS-domain OrgUnitRef's own field, not this one's.
    const withCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste', code: 'ORG' };
    expect(withCode).toBeDefined();
  });
});

describe('VersionConflictProblem (audit.openapi.yaml)', () => {
  it("carries no `currentStatus` — unlike `features/controls/types.ts`'s own copy of the same schema name", () => {
    const value: VersionConflictProblem = {
      title: 'The record was modified by another user',
      status: 409,
      currentVersion: 2,
    };
    expect(value.currentVersion).toBe(2);

    const withCurrentStatus: VersionConflictProblem = {
      title: 'x',
      status: 409,
      currentVersion: 2,
      // @ts-expect-error -- `currentStatus` belongs to `ControlStatus`'s own VersionConflictProblem, not this one's (this contract declares no such property).
      currentStatus: 'PLANNING',
    };
    expect(withCurrentStatus).toBeDefined();
  });
});
