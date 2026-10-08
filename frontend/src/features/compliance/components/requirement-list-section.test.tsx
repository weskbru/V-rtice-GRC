import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RequirementListSection } from './requirement-list-section';

import type { Requirement } from '../types';

const { listRequirementsMock, createRequirementMock } = vi.hoisted(() => ({
  listRequirementsMock: vi.fn(),
  createRequirementMock: vi.fn(),
}));

vi.mock('../api', () => ({
  complianceApi: {
    listRequirements: listRequirementsMock,
    createRequirement: createRequirementMock,
  },
}));

function requirementFixture(overrides: Partial<Requirement>): Requirement {
  return {
    id: 'req-1',
    frameworkVersion: { id: 'version-1', label: '2022', status: 'DRAFT' },
    externalRef: 'A.5.1',
    title: 'Política de segurança da informação',
    description: 'Descrição da cláusula.',
    applicability: null,
    complianceState: 'NOT_MET',
    version: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('RequirementListSection', () => {
  beforeEach(() => {
    listRequirementsMock.mockReset();
    createRequirementMock.mockReset();
  });

  it('shows the genuinely-empty state when the version has no requirement yet', async () => {
    listRequirementsMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft
        canAdminister={false}
      />,
    );

    expect(await screen.findByText('Nenhum requisito cadastrado')).toBeInTheDocument();
  });

  it('lists a fetched requirement with its calculated compliance state — never colour alone', async () => {
    listRequirementsMock.mockResolvedValue({
      data: [requirementFixture({})],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft
        canAdminister={false}
      />,
    );

    expect(await screen.findByText('Política de segurança da informação')).toBeInTheDocument();
    expect(screen.getByText('A.5.1')).toBeInTheDocument();
    expect(screen.getByText('Não atendido')).toBeInTheDocument();
  });

  it('links each row to its own requirement detail screen', async () => {
    listRequirementsMock.mockResolvedValue({
      data: [requirementFixture({})],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft
        canAdminister={false}
      />,
    );

    const link = await screen.findByRole('link', { name: 'Política de segurança da informação' });
    expect(link).toHaveAttribute('href', '/compliance/fmk-1/versions/version-1/requirements/req-1');
  });

  it('shows a retry action on a failed load, never a silent empty list', async () => {
    const { ApiError } = await import('@/lib/api-client');
    listRequirementsMock.mockRejectedValueOnce(new ApiError({ title: 'Erro', status: 500 }));
    listRequirementsMock.mockResolvedValueOnce({
      data: [requirementFixture({})],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft
        canAdminister={false}
      />,
    );

    const retry = await screen.findByRole('button', { name: 'Tentar novamente' });
    fireEvent.click(retry);

    expect(await screen.findByText('Política de segurança da informação')).toBeInTheDocument();
  });

  it('hides the create action once the version has published (FR-004)', async () => {
    listRequirementsMock.mockResolvedValue({
      data: [
        requirementFixture({
          frameworkVersion: { id: 'version-1', label: '2022', status: 'PUBLISHED' },
        }),
      ],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft={false}
        canAdminister
      />,
    );

    await screen.findByText('Política de segurança da informação');
    expect(screen.queryByRole('button', { name: 'Cadastrar requisito' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/requisitos de uma versão publicada são imutáveis/),
    ).toBeInTheDocument();
  });

  it('creates a requirement through the dialog and reloads the list', async () => {
    listRequirementsMock.mockResolvedValueOnce({
      data: [],
      meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 },
    });
    createRequirementMock.mockResolvedValue({
      record: requirementFixture({}),
      etag: '"1"',
    });
    listRequirementsMock.mockResolvedValueOnce({
      data: [requirementFixture({})],
      meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 },
    });

    render(
      <RequirementListSection
        frameworkId="fmk-1"
        versionId="version-1"
        versionIsDraft
        canAdminister
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Cadastrar requisito' }));
    fireEvent.change(await screen.findByLabelText(/^Identificador na norma/), {
      target: { value: 'A.5.1' },
    });
    fireEvent.change(screen.getByLabelText(/^Título/), {
      target: { value: 'Política de segurança da informação' },
    });
    fireEvent.change(screen.getByLabelText(/^Descrição/), {
      target: { value: 'Descrição da cláusula.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cadastrar requisito' }));

    await waitFor(() => expect(createRequirementMock).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Política de segurança da informação')).toBeInTheDocument();
  });
});
