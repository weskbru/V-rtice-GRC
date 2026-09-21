import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MappingMigrationDialog } from './mapping-migration-dialog';

import type { FrameworkVersion, MappingMigrationDetail, Requirement } from '../types';

/**
 * Component-mount evidence for `MappingMigrationDialog` (US2, FR-012 to
 * FR-014, research.md D-6). `../api` is mocked at the network boundary —
 * this test exercises the decision the spec insists is the human's, never
 * the system's: nothing here is auto-selected, every correspondence is a
 * deliberate click, and a target left with no chip is simply omitted from
 * `correspondences`.
 */
const { listFrameworkVersionsMock, listRequirementsMock, executeMappingMigrationMock } = vi.hoisted(
  () => ({
    listFrameworkVersionsMock: vi.fn(),
    listRequirementsMock: vi.fn(),
    executeMappingMigrationMock: vi.fn(),
  }),
);

vi.mock('../api', () => ({
  complianceApi: {
    listFrameworkVersions: listFrameworkVersionsMock,
    listRequirements: listRequirementsMock,
    executeMappingMigration: executeMappingMigrationMock,
  },
}));

const sourceVersion: FrameworkVersion = {
  id: 'version-1',
  framework: { id: 'fmk-1', code: 'FMK-2026-0001', name: 'ISO 27001' },
  label: '2019',
  status: 'PUBLISHED',
  publishedAt: '2025-01-01T00:00:00.000Z',
  publishedBy: { id: 'user-1', fullName: 'Ana Souza' },
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const sourceRequirement: Requirement = {
  id: 'req-source-1',
  frameworkVersion: { id: 'version-1', label: '2019', status: 'PUBLISHED' },
  externalRef: 'A.5.1',
  title: 'Política de segurança (2019)',
  description: 'Descrição.',
  applicability: null,
  complianceState: 'COMPLIANT',
  version: 1,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const targetRequirement: Requirement = {
  ...sourceRequirement,
  id: 'req-target-1',
  frameworkVersion: { id: 'version-2', label: '2022', status: 'DRAFT' },
  title: 'Política de segurança (2022)',
};

function pageOf<T>(data: readonly T[]) {
  return { data, meta: { page: 1, pageSize: 100, total: data.length, totalPages: 1 } };
}

describe('MappingMigrationDialog', () => {
  beforeEach(() => {
    listFrameworkVersionsMock.mockReset();
    listRequirementsMock.mockReset();
    executeMappingMigrationMock.mockReset();
    listFrameworkVersionsMock.mockResolvedValue(pageOf([sourceVersion]));
  });

  it('offers every other version of the framework as a source, excluding the target itself', async () => {
    render(
      <MappingMigrationDialog
        open
        onOpenChange={vi.fn()}
        frameworkId="fmk-1"
        targetVersionId="version-2"
        onExecuted={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Versão de origem' }));
    expect(await screen.findByRole('option', { name: '2019' })).toBeInTheDocument();
  });

  it('never proposes a correspondence itself — the target starts with the "pending" hint until a source is chosen', async () => {
    listRequirementsMock.mockImplementation((_frameworkId: string, versionId: string) =>
      Promise.resolve(
        pageOf(versionId === 'version-2' ? [targetRequirement] : [sourceRequirement]),
      ),
    );

    render(
      <MappingMigrationDialog
        open
        onOpenChange={vi.fn()}
        frameworkId="fmk-1"
        targetVersionId="version-2"
        onExecuted={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Versão de origem' }));
    fireEvent.click(await screen.findByRole('option', { name: '2019' }));

    expect(await screen.findByText(/Política de segurança \(2022\)/)).toBeInTheDocument();
    expect(
      screen.getByText(/Sem correspondência — ficará pendente de decisão/),
    ).toBeInTheDocument();
  });

  it('adds a chosen correspondence as a removable chip, then submits it in the request', async () => {
    listRequirementsMock.mockImplementation((_frameworkId: string, versionId: string) =>
      Promise.resolve(
        pageOf(versionId === 'version-2' ? [targetRequirement] : [sourceRequirement]),
      ),
    );
    const detail: MappingMigrationDetail = {
      id: 'migration-1',
      sourceFrameworkVersion: { id: 'version-1', label: '2019', status: 'PUBLISHED' },
      targetFrameworkVersion: { id: 'version-2', label: '2022', status: 'DRAFT' },
      executedBy: { id: 'user-1', fullName: 'Ana Souza' },
      executedAt: '2026-02-01T00:00:00.000Z',
      itemCount: 1,
      copiedCount: 1,
      pendingDecisionCount: 0,
      skippedAlreadyMappedCount: 0,
      items: [
        {
          targetRequirement: {
            id: 'req-target-1',
            externalRef: 'A.5.1',
            title: 'Política de segurança (2022)',
          },
          sourceRequirements: [
            { id: 'req-source-1', externalRef: 'A.5.1', title: 'Política de segurança (2019)' },
          ],
          outcome: 'COPIED',
          copiedLinkCount: 1,
        },
      ],
    };
    executeMappingMigrationMock.mockResolvedValue(detail);
    const onExecuted = vi.fn();

    render(
      <MappingMigrationDialog
        open
        onOpenChange={vi.fn()}
        frameworkId="fmk-1"
        targetVersionId="version-2"
        onExecuted={onExecuted}
      />,
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Versão de origem' }));
    fireEvent.click(await screen.findByRole('option', { name: '2019' }));
    await screen.findByText(/Política de segurança \(2022\)/);

    fireEvent.click(screen.getByRole('combobox', { name: 'Adicionar correspondência' }));
    fireEvent.click(await screen.findByRole('option', { name: /Política de segurança \(2019\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByText(/Política de segurança \(2019\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Executar migração' }));

    await waitFor(() =>
      expect(executeMappingMigrationMock).toHaveBeenCalledWith('fmk-1', 'version-2', {
        sourceFrameworkVersionId: 'version-1',
        correspondences: [
          { targetRequirementId: 'req-target-1', sourceRequirementIds: ['req-source-1'] },
        ],
      }),
    );
    expect(await screen.findByText('Transportado')).toBeInTheDocument();
    expect(onExecuted).toHaveBeenCalledWith(detail);
  });

  it('shows the pending-decision result as unfinished work, never as success', async () => {
    listRequirementsMock.mockResolvedValue(pageOf([]));
    const detail: MappingMigrationDetail = {
      id: 'migration-2',
      sourceFrameworkVersion: { id: 'version-1', label: '2019', status: 'PUBLISHED' },
      targetFrameworkVersion: { id: 'version-2', label: '2022', status: 'DRAFT' },
      executedBy: { id: 'user-1', fullName: 'Ana Souza' },
      executedAt: '2026-02-01T00:00:00.000Z',
      itemCount: 1,
      copiedCount: 0,
      pendingDecisionCount: 1,
      skippedAlreadyMappedCount: 0,
      items: [
        {
          targetRequirement: {
            id: 'req-target-2',
            externalRef: 'A.6.1',
            title: 'Controle de acesso',
          },
          sourceRequirements: [],
          outcome: 'PENDING_DECISION',
          copiedLinkCount: 0,
        },
      ],
    };
    executeMappingMigrationMock.mockResolvedValue(detail);

    render(
      <MappingMigrationDialog
        open
        onOpenChange={vi.fn()}
        frameworkId="fmk-1"
        targetVersionId="version-2"
        onExecuted={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole('combobox', { name: 'Versão de origem' }));
    fireEvent.click(await screen.findByRole('option', { name: '2019' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Executar migração' }));

    expect(
      await screen.findByText(
        '1 requisito ficou pendente de decisão — ainda precisa de mapeamento.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Pendente de decisão')).toBeInTheDocument();
  });
});
