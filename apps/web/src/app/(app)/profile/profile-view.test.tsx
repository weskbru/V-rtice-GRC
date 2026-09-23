import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  const actual = await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
  return { ...actual, apiClient: { ...actual.apiClient, get: getMock } };
});

vi.mock('./change-password-form', () => ({
  ChangePasswordForm: (): React.JSX.Element => <div data-testid="change-password-form" />,
}));

// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import * as ApiClientModule from '@/lib/api-client';

import { ProfileView } from './profile-view';

import type { OwnProfile, RoleRef } from '@/lib/auth-types';

function profileWithRoles(roles: readonly RoleRef[]): OwnProfile {
  return {
    id: 'u-1',
    email: 'ana.pereira@example.local',
    fullName: 'Ana Pereira',
    jobTitle: 'Auditora Interna',
    status: 'ACTIVE',
    primaryOrgUnit: { id: 'ou-1', code: 'DIV-A', name: 'Diretoria de Riscos' },
    roles,
    lastLoginAt: '2026-09-10T12:00:00.000Z',
  };
}

async function renderWithRoles(roles: readonly RoleRef[]): Promise<void> {
  getMock.mockReset();
  getMock.mockResolvedValue(profileWithRoles(roles));
  render(<ProfileView forcedPasswordChange={false} />);
  await waitFor(() => {
    expect(screen.getByText('Ana Pereira')).toBeInTheDocument();
  });
}

describe('the Perfil identity card names roles in pt-BR', () => {
  it('prints the six roles that used to render in English here', async () => {
    await renderWithRoles([
      { id: 'r-1', name: 'Audit Lead' },
      { id: 'r-2', name: 'Compliance Manager' },
      { id: 'r-3', name: 'Control Owner' },
      { id: 'r-4', name: 'Control Approver' },
      { id: 'r-5', name: 'Incident Manager' },
      { id: 'r-6', name: 'Problem Manager' },
    ]);

    expect(
      screen.getByText(
        'Líder de Auditoria, Gestor de Compliance, Responsável por Controle, Aprovador de Controle, Gestor de Incidentes, Gestor de Problemas',
      ),
    ).toBeInTheDocument();
  });

  it('leaves no stored English role name on the screen', async () => {
    await renderWithRoles([
      { id: 'r-1', name: 'Compliance Manager' },
      { id: 'r-2', name: 'Audit Lead' },
    ]);

    expect(screen.queryByText(/Compliance Manager/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Audit Lead/)).not.toBeInTheDocument();
  });

  it('prints the six that always worked, unchanged', async () => {
    await renderWithRoles([
      { id: 'r-1', name: 'Platform Administrator' },
      { id: 'r-2', name: 'Risk Manager' },
      { id: 'r-3', name: 'Risk Analyst' },
      { id: 'r-4', name: 'Risk Approver' },
      { id: 'r-5', name: 'Auditor' },
      { id: 'r-6', name: 'Read Only' },
    ]);

    expect(
      screen.getByText(
        'Administrador da Plataforma, Gestor de Riscos, Analista de Riscos, Aprovador de Riscos, Auditor, Somente Leitura',
      ),
    ).toBeInTheDocument();
  });

  it('prints a custom role exactly as it was typed, translating nothing', async () => {
    await renderWithRoles([
      { id: 'r-1', name: 'Auditoria Interna — Filial SP' },
      { id: 'r-2', name: 'Compliance Manager' },
    ]);

    expect(
      screen.getByText('Auditoria Interna — Filial SP, Gestor de Compliance'),
    ).toBeInTheDocument();
  });

  it('says so when a person holds no role at all', async () => {
    await renderWithRoles([]);

    expect(screen.getByText('Nenhum atribuído')).toBeInTheDocument();
  });
});
