import { describe, expect, it } from 'vitest';

import type { OrgUnitRef } from './types';

describe('OrgUnitRef (contract-backed, assurance-audit Fix 3)', () => {
  it('is exactly {id, name} — the shape grc-foundation.openapi.yaml actually declares', () => {
    const value: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` pertence ao OrgUnitRef de Riscos.
    const withCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste', code: 'ORG' };
    expect(withCode).toBeDefined();
  });
});
