import { describe, expect, it } from 'vitest';

import type {
  AssetDetail,
  AssetSummary,
  CreateAssetRequest,
  OrgUnitRef,
  UpdateAssetRequest,
} from './types';

describe('OrgUnitRef (assets.openapi.yaml)', () => {
  it('is exactly {id, code, name} — the RISKS/CONTROLS-domain shape, unlike audit-engagements', () => {
    const value: OrgUnitRef = { id: 'org-1', code: 'ORG', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', code: 'ORG', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` is required on THIS module's OrgUnitRef; omitting it must not silently type-check.
    const withoutCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(withoutCode).toBeDefined();
  });
});

describe('AssetSummary.orgUnit (data-model.md §1/§6, research.md D-2)', () => {
  it('is a REQUIRED property whose value may be null — never optional, never an invented unit', () => {
    const legacyAsset: AssetSummary = {
      id: 'asset-1',
      code: 'AST-2026-0001',
      name: 'Ativo de teste',
      descriptionExcerpt: null,
      orgUnit: null,
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(legacyAsset.orgUnit).toBeNull();

    // @ts-expect-error -- `orgUnit` is required; omitting the key entirely must not silently type-check.
    const missing: AssetSummary = {
      id: 'asset-1',
      code: 'AST-2026-0001',
      name: 'Ativo de teste',
      descriptionExcerpt: null,
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(missing).toBeDefined();
  });
});

describe('CreateAssetRequest / UpdateAssetRequest (invariant A6)', () => {
  it('CreateAssetRequest never accepts `code`, `isActive` or a `version` — server-owned', () => {
    // @ts-expect-error -- `code` is server-generated (AST- prefix); the API rejects it as an unknown property.
    const withCode: CreateAssetRequest = { name: 'Ativo', orgUnitId: 'org-1', code: 'AST-0001' };
    expect(withCode).toBeDefined();

    // @ts-expect-error -- `isActive` is server-owned; a created asset is always active.
    const withIsActive: CreateAssetRequest = { name: 'Ativo', orgUnitId: 'org-1', isActive: true };
    expect(withIsActive).toBeDefined();

    // @ts-expect-error -- this resource carries no optimistic-locking version at all (see types.ts's own header comment).
    const withVersion: CreateAssetRequest = { name: 'Ativo', orgUnitId: 'org-1', version: 1 };
    expect(withVersion).toBeDefined();
  });

  it('UpdateAssetRequest never accepts `code` or `isActive` either — situation changes only through the dedicated transitions', () => {
    // @ts-expect-error -- `code` is read-only.
    const withCode: UpdateAssetRequest = { code: 'AST-0001' };
    expect(withCode).toBeDefined();

    // @ts-expect-error -- `isActive` is read-only; use `deactivateAsset`/`reactivateAsset` instead.
    const withIsActive: UpdateAssetRequest = { isActive: false };
    expect(withIsActive).toBeDefined();
  });
});

describe('AssetDetail carries no optimistic-locking version (contract-deliberate, see types.ts header)', () => {
  it('has no `version` key in its type — unlike `ControlDetail`/`AuditEngagement`', () => {
    type HasVersion = 'version' extends keyof AssetDetail ? true : false;
    const hasVersion: HasVersion = false;
    expect(hasVersion).toBe(false);
  });
});
