import { describe, expect, it } from 'vitest';

import type { OrgUnitRef, VersionConflictProblem } from './types';

describe('OrgUnitRef (audit.openapi.yaml)', () => {
  it('is exactly {id, name} — no `code`, unlike the RISKS-domain OrgUnitRef', () => {
    const value: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` pertence ao OrgUnitRef de Riscos.
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
      // @ts-expect-error -- `currentStatus` pertence ao VersionConflictProblem de ControlStatus.
      currentStatus: 'PLANNING',
    };
    expect(withCurrentStatus).toBeDefined();
  });
});
