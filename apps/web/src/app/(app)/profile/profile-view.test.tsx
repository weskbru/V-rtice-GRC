import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * PharosGRC — the Perfil identity card prints role names through the ONE
 * catalogue (ADR-022 as amended 2026-09-14, CLAUDE.md §11.1 and §19.7).
 *
 * ## The defect this file exists because of
 *
 * This screen carried its own map, `profile.identity.roleLabels`, from phase
 * 001 onwards. It named SIX of the twelve seeded roles. The other six — Audit
 * Lead, Compliance Manager, Control Owner, Control Approver, Incident Manager,
 * Problem Manager — were seeded by later phases and never added, and the
 * lookup was `map[name] ?? name`, so those six simply printed their stored
 * English `Role.name`. Six roles in pt-BR and six in English, on the same
 * line, for fourteen phases, with every gate green: a fallback never fails,
 * and nothing rendered this screen with one of the six.
 *
 * That is the specific gap these assertions close. They are written against
 * the six that were broken, not against the six that always worked, because a
 * test that only checked "Gestor de Riscos" would have been green the entire
 * time the defect was shipping.
 *
 * ## Why the custom-role case is here too
 *
 * The correct behaviour for a role somebody typed is NO translation — the
 * name, exactly as stored. That is the half most easily broken by a "fix"
 * that maps aggressively, and it is asserted on this screen, not only on the
 * resolver, because this screen is where a person's own roles are shown.
 */

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }));

vi.mock('@/lib/api-client', async () => {
  // The real module is kept: the screen's error branch does
  // `error instanceof ApiError`, which needs the actual class, not a stub.
  const actual = await vi.importActual<typeof ApiClientModule>('@/lib/api-client');
  return { ...actual, apiClient: { ...actual.apiClient, get: getMock } };
});

// The password form has its own navigation and toast dependencies and its own
// tests; this file is about the identity card.
vi.mock('./change-password-form', () => ({
  ChangePasswordForm: (): React.JSX.Element => <div data-testid="change-password-form" />,
}));

// `typeof ApiClientModule` above needs a real value import — `import type *
// as ApiClientModule` cannot be used as a type argument (TS2709), so this one
// import is deliberately not `import type`, exactly as `login-form.test.tsx`
// does for the same reason.
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
    // The assertion above would still pass if the line ALSO contained the
    // English name somewhere; this one says the stored identifier is not
    // rendered at all on this screen.
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
