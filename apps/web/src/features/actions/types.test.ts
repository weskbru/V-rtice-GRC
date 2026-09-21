import { describe, expect, it } from 'vitest';

import type { OrgUnitRef } from './types';

/**
 * Companion to `features/evidence/types.test.ts`/`features/findings/types
 * .test.ts`. `actions/types.ts` never carried the "type lie" itself — its
 * `OrgUnitRef` was already correctly hand-declared as `{id, name}` before
 * assurance-audit Fix 3 — but it now sources that same shape from the
 * generated `@pharos/api-types` contract instead of a third hand-written
 * copy, so this guards the same invariant going forward: `code` must never
 * be accepted here either.
 */
describe('OrgUnitRef (contract-backed, assurance-audit Fix 3)', () => {
  it('is exactly {id, name} — the shape grc-foundation.openapi.yaml actually declares', () => {
    const value: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` is the RISKS-domain OrgUnitRef's own field, not this one's.
    const withCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste', code: 'ORG' };
    expect(withCode).toBeDefined();
  });
});
