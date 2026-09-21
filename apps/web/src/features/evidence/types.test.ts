import { describe, expect, it } from 'vitest';

import type { OrgUnitRef } from './types';

/**
 * Compile-time regression test for assurance-audit Fix 3.
 *
 * Before this fix, `Evidence`'s `orgUnit` field was typed as the
 * RISKS-domain `OrgUnitRef` (`@/features/risks/types`), which additionally
 * REQUIRES `code` — a field `grc-foundation.openapi.yaml`'s own
 * `OrgUnitRef` schema never declares and the live API for Evidence never
 * returns. Nothing read `.code` yet, so the lie never fired at runtime,
 * but nothing stopped it either.
 *
 * `@ts-expect-error` makes this a REAL regression test, not a comment: if
 * `OrgUnitRef` is ever widened back to accept `code` (e.g. a careless
 * re-import from `features/risks/types`), the line below stops producing
 * an error, TypeScript reports "Unused '@ts-expect-error' directive", and
 * `pnpm --filter @pharos/web run typecheck` (part of this project's
 * required verification, CLAUDE.md §13/§14) fails.
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
