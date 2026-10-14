import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UserAdminCard } from './user-admin-card';

import type { AdminUser } from '../../types';

const baseUser: AdminUser = {
  id: 'user-1',
  email: 'ana.souza@verticegrc.local',
  fullName: 'Ana Souza',
  jobTitle: 'Analista de Riscos Sênior',
  status: 'ACTIVE',
  primaryOrgUnit: { id: 'org-1', code: 'TI', name: 'Tecnologia da Informação' },
  roles: [{ id: 'role-1', name: 'Risk Analyst' }],
  authenticationMethods: ['LOCAL'],
  lastLoginAt: '2026-09-10T14:30:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const noop = vi.fn();

describe('UserAdminCard', () => {
  it('renders the initials, full name, e-mail, status and every real field the table shows', () => {
    render(
      <UserAdminCard
        user={baseUser}
        currentUserId="someone-else"
        canManageUsers={true}
        canManageRoles={true}
        onEdit={noop}
        onToggleStatus={noop}
        onResetPassword={noop}
        onRevokeSessions={noop}
        onManageRoles={noop}
      />,
    );

    expect(screen.getByText('AS')).toBeInTheDocument();
    expect(screen.getByText('Ana Souza')).toBeInTheDocument();
    expect(screen.getByText('ana.souza@verticegrc.local')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();
    expect(screen.getByText('Tecnologia da Informação')).toBeInTheDocument();
    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
    expect(
      screen.getByText(new Date(baseUser.lastLoginAt!).toLocaleString('pt-BR')),
    ).toBeInTheDocument();
  });

  it('renders EmptyValue for a missing org unit and "Nunca acessou" for a null lastLoginAt', () => {
    render(
      <UserAdminCard
        user={{ ...baseUser, primaryOrgUnit: null, lastLoginAt: null }}
        currentUserId="someone-else"
        canManageUsers={true}
        canManageRoles={true}
        onEdit={noop}
        onToggleStatus={noop}
        onResetPassword={noop}
        onRevokeSessions={noop}
        onManageRoles={noop}
      />,
    );

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('Nunca acessou')).toBeInTheDocument();
  });

  it('renders the shared row-actions menu trigger, reachable exactly like the table cell', () => {
    render(
      <UserAdminCard
        user={baseUser}
        currentUserId="someone-else"
        canManageUsers={true}
        canManageRoles={true}
        onEdit={noop}
        onToggleStatus={noop}
        onResetPassword={noop}
        onRevokeSessions={noop}
        onManageRoles={noop}
      />,
    );

    expect(screen.getByRole('button', { name: 'Ações para Ana Souza' })).toBeInTheDocument();
  });
});
