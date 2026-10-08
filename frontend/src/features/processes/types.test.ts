import { describe, expect, it } from 'vitest';

import type {
  CreateProcessRequest,
  OrgUnitRef,
  ProcessDetail,
  ProcessSummary,
  UpdateProcessRequest,
} from './types';

describe('OrgUnitRef (processes.openapi.yaml)', () => {
  it('is exactly {id, code, name} — the RISKS/CONTROLS-domain shape, unlike audit-engagements', () => {
    const value: OrgUnitRef = { id: 'org-1', code: 'ORG', name: 'Unidade de teste' };
    expect(value).toEqual({ id: 'org-1', code: 'ORG', name: 'Unidade de teste' });

    // @ts-expect-error -- `code` pertence ao OrgUnitRef de Riscos.
    const withoutCode: OrgUnitRef = { id: 'org-1', name: 'Unidade de teste' };
    expect(withoutCode).toBeDefined();
  });
});

describe('ProcessSummary.orgUnit (data-model.md §1/§6, research.md D-2)', () => {
  it('is a REQUIRED property whose value may be null — never optional, never an invented unit', () => {
    const legacyProcess: ProcessSummary = {
      id: 'process-1',
      code: 'PRC-2026-0001',
      name: 'Processo de teste',
      descriptionExcerpt: null,
      orgUnit: null,
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(legacyProcess.orgUnit).toBeNull();

    // @ts-expect-error -- `orgUnit` é obrigatório.
    const missing: ProcessSummary = {
      id: 'process-1',
      code: 'PRC-2026-0001',
      name: 'Processo de teste',
      descriptionExcerpt: null,
      isActive: true,
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    expect(missing).toBeDefined();
  });
});

describe('CreateProcessRequest / UpdateProcessRequest (invariant A6)', () => {
  it('CreateProcessRequest never accepts `code`, `isActive` or a `version` — server-owned', () => {
    // @ts-expect-error -- `code` é gerado pelo servidor (prefixo PRC-).
    const withCode: CreateProcessRequest = { name: 'P', orgUnitId: 'org-1', code: 'PRC-0001' };
    expect(withCode).toBeDefined();

    // @ts-expect-error -- `isActive` é definido pelo servidor.
    const withIsActive: CreateProcessRequest = { name: 'P', orgUnitId: 'org-1', isActive: true };
    expect(withIsActive).toBeDefined();

    // @ts-expect-error -- este tipo não inclui versão para controle otimista.
    const withVersion: CreateProcessRequest = { name: 'Processo', orgUnitId: 'org-1', version: 1 };
    expect(withVersion).toBeDefined();
  });

  it('UpdateProcessRequest never accepts `code` or `isActive` either — situation changes only through the dedicated transitions', () => {
    // @ts-expect-error -- `code` é somente leitura.
    const withCode: UpdateProcessRequest = { code: 'PRC-0001' };
    expect(withCode).toBeDefined();

    // @ts-expect-error -- `isActive` é somente leitura; use `deactivateProcess` ou `reactivateProcess`.
    const withIsActive: UpdateProcessRequest = { isActive: false };
    expect(withIsActive).toBeDefined();
  });
});

describe('ProcessDetail carries no optimistic-locking version (contract-deliberate, see types.ts header)', () => {
  it('has no `version` key in its type — unlike `ControlDetail`/`AuditEngagement`', () => {
    type HasVersion = 'version' extends keyof ProcessDetail ? true : false;
    const hasVersion: HasVersion = false;
    expect(hasVersion).toBe(false);
  });
});
