import { describe, expect, it } from 'vitest';

import type { Finding, OrgUnitRef } from './types';

describe('OrgUnitRef (contract-backed, assurance-audit Fix 3)', () => {
  it('is exactly {id, name} — the shape grc-foundation.openapi.yaml actually declares', () => {
    const value: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` is the RISKS-domain OrgUnitRef's own field, not this one's.
    const withCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste', code: 'ORG' };
    expect(withCode).toBeDefined();
  });
});

const BASE_FINDING: Omit<Finding, 'auditEngagementId'> = {
  id: 'finding-1',
  code: 'FND-2026-0001',
  orgUnit: { id: 'org-1', name: 'Unidade de teste' },
  title: 'Achado de teste',
  description: 'Descrição de teste',
  recommendation: null,
  category: 'OBSERVATION',
  origin: 'INTERNAL_ASSESSMENT',
  severity: 'LOW',
  priority: 'LOW',
  owner: { id: 'user-1', fullName: 'Usuário de teste' },
  identifiedOn: '2026-01-01',
  status: 'OPEN',
  openActionCount: 0,
  evidenceCount: 0,
  closedAt: null,
  closureJustification: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('Finding.auditEngagementId (005-audit-findings, SC-001)', () => {
  it('accepts null — a manually recorded finding', () => {
    const manual: Finding = { ...BASE_FINDING, auditEngagementId: null };
    expect(manual.auditEngagementId).toBeNull();
  });

  it('accepts a string — a finding produced by an engagement', () => {
    const produced: Finding = { ...BASE_FINDING, auditEngagementId: 'audit-1' };
    expect(produced.auditEngagementId).toBe('audit-1');
  });

  it('cannot be omitted — it is required, never optional', () => {
    // @ts-expect-error -- `auditEngagementId` is required; omitting it must not silently type-check.
    const missing: Finding = { ...BASE_FINDING };
    expect(missing).toBeDefined();
  });
});
