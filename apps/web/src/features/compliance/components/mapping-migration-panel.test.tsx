import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MappingMigrationPanel } from './mapping-migration-panel';

import type { MappingMigrationSummary } from '../types';

const { listMappingMigrationsMock, listFrameworkVersionsMock } = vi.hoisted(() => ({
  listMappingMigrationsMock: vi.fn(),
  listFrameworkVersionsMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    listMappingMigrations: listMappingMigrationsMock,
    listFrameworkVersions: listFrameworkVersionsMock,
  },
}));

function summaryFixture(overrides: Partial<MappingMigrationSummary>): MappingMigrationSummary {
  return {
    id: 'migration-1',
    sourceFrameworkVersion: { id: 'version-1', label: '2019', status: 'PUBLISHED' },
    targetFrameworkVersion: { id: 'version-2', label: '2022', status: 'DRAFT' },
    executedBy: { id: 'user-1', fullName: 'Ana Souza' },
    executedAt: '2026-02-01T00:00:00.000Z',
    itemCount: 10,
    copiedCount: 7,
    pendingDecisionCount: 2,
    skippedAlreadyMappedCount: 1,
    ...overrides,
  };
}

describe('MappingMigrationPanel', () => {
  beforeEach(() => {
    listMappingMigrationsMock.mockReset();
    listFrameworkVersionsMock.mockReset();
    listFrameworkVersionsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 100, total: 0, totalPages: 0 },
    });
  });

  it('shows the honest empty state when no migration has run yet', async () => {
    listMappingMigrationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });

    render(<MappingMigrationPanel frameworkId="fmk-1" versionId="version-2" canMap={false} />);

    expect(
      await screen.findByText(
        'Nenhuma migração de mapeamento foi executada para esta versão ainda.',
      ),
    ).toBeInTheDocument();
  });

  it('lists an executed migration with its outcome counts', async () => {
    listMappingMigrationsMock.mockResolvedValue({
      data: [summaryFixture({})],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(<MappingMigrationPanel frameworkId="fmk-1" versionId="version-2" canMap={false} />);

    expect(await screen.findByText('2019')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('hides the "nova migração" action when the caller lacks compliance:map', async () => {
    listMappingMigrationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });

    render(<MappingMigrationPanel frameworkId="fmk-1" versionId="version-2" canMap={false} />);

    await screen.findByText('Nenhuma migração de mapeamento foi executada para esta versão ainda.');
    expect(screen.queryByRole('button', { name: 'Nova migração' })).not.toBeInTheDocument();
  });

  it('shows the "nova migração" action when the caller has compliance:map', async () => {
    listMappingMigrationsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });

    render(<MappingMigrationPanel frameworkId="fmk-1" versionId="version-2" canMap />);

    expect(await screen.findByRole('button', { name: 'Nova migração' })).toBeInTheDocument();
  });
});
