import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listUsersMock } = vi.hoisted(() => ({ listUsersMock: vi.fn() }));

vi.mock('../../api', () => ({ adminApi: { listUsers: listUsersMock } }));

import { RoleUsersTab } from './role-users-tab';

import type { AdminUser, Permission, Role } from '../../types';

function permission(identifier: string, resource: string): Permission {
  return { identifier, resource, action: 'VIEW', description: identifier };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Analista de Riscos',
    description: 'Analisa e trata riscos operacionais.',
    isSystem: false,
    assignedUserCount: 3,
    permissions: [permission('risk:view', 'risk')],
    ...overrides,
  };
}

function adminUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'u1',
    email: 'ana.pereira@example.local',
    fullName: 'Ana Pereira',
    jobTitle: 'Auditora Interna',
    status: 'ACTIVE',
    primaryOrgUnit: { id: 'o1', code: 'TI', name: 'Tecnologia da Informação' },
    roles: [
      { id: 'role-1', name: 'Analista de Riscos' },
      { id: 'role-2', name: 'Audit Lead' },
    ],
    authenticationMethods: ['LOCAL'],
    lastLoginAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  listUsersMock.mockReset();
});

describe('RoleUsersTab — WITHOUT user:administer (scenario 1, FR-018/FR-020, SC-006)', () => {
  it('makes no request and puts no personal datum in the DOM, showing only the aggregate count', async () => {
    listUsersMock.mockResolvedValue({
      data: [adminUser()],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: 3 })}
        canAdministerUsers={false}
        canManageOrgUnits={false}
      />,
    );

    expect(screen.getByText('Relação de pessoas indisponível')).toBeInTheDocument();
    expect(screen.getByText('3 pessoas têm este papel')).toBeInTheDocument();
    expect(
      screen.getByText(/exige a permissão de administração de usuários \(user:administer\)/),
    ).toBeInTheDocument();

    expect(listUsersMock).not.toHaveBeenCalled();

    await waitFor(() => expect(listUsersMock).not.toHaveBeenCalled());
    const markup = document.body.innerHTML;
    expect(markup).not.toContain('Ana Pereira');
    expect(markup).not.toContain('ana.pereira@example.local');
    expect(markup).not.toContain('Auditora Interna');
    expect(markup).not.toContain('Tecnologia da Informação');
  });

  it('counts a single holder in the singular', () => {
    render(
      <RoleUsersTab
        role={role({ assignedUserCount: 1 })}
        canAdministerUsers={false}
        canManageOrgUnits={false}
      />,
    );
    expect(screen.getByText('1 pessoa tem este papel')).toBeInTheDocument();
  });
});

describe('RoleUsersTab — WITH user:administer (scenario 2, FR-021/FR-024/FR-025)', () => {
  it('lists each person with the fields UserResponse carries, in exactly one request', async () => {
    listUsersMock.mockResolvedValue({
      data: [adminUser()],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<RoleUsersTab role={role()} canAdministerUsers canManageOrgUnits={false} />);

    expect(await screen.findByText('Ana Pereira')).toBeInTheDocument();
    expect(screen.getByText('ana.pereira@example.local')).toBeInTheDocument();
    expect(screen.getByText('Auditora Interna')).toBeInTheDocument();
    expect(screen.getByText('Tecnologia da Informação')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();

    expect(screen.getByText('Líder de Auditoria')).toBeInTheDocument();
    expect(screen.queryByText('Audit Lead')).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'Os demais papéis atribuídos à mesma pessoa. O acesso dela é a união de todos eles, inclusive deste.',
      ),
    ).toBeInTheDocument();
    expect(document.body.textContent ?? '').not.toMatch(/herdad/i);

    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, roleId: 'role-1' });
  });

  it('names a person with no other role rather than leaving the field blank', async () => {
    listUsersMock.mockResolvedValue({
      data: [adminUser({ roles: [{ id: 'role-1', name: 'Analista de Riscos' }] })],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<RoleUsersTab role={role()} canAdministerUsers canManageOrgUnits={false} />);

    expect(await screen.findByText('Ana Pereira')).toBeInTheDocument();
    expect(screen.getByText('Nenhum outro papel')).toBeInTheDocument();
  });

  it('reports a failed roster load without pretending the role has no holders', async () => {
    listUsersMock.mockRejectedValue(new Error('boom'));

    render(<RoleUsersTab role={role()} canAdministerUsers canManageOrgUnits={false} />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não foi possível carregar as pessoas com este papel.');
    expect(screen.queryByText('Nenhuma pessoa tem este papel.')).not.toBeInTheDocument();
  });

  it('says so plainly when the role genuinely has no holders', async () => {
    listUsersMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: 0 })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );

    expect(await screen.findByText('Nenhuma pessoa tem este papel.')).toBeInTheDocument();
  });
});

describe('RoleUsersTab — organizational scope is a dimension of the USER (FR-022/FR-023)', () => {
  it('states that scope is granted per user and not by this role, in both permission states', () => {
    const { unmount } = render(
      <RoleUsersTab role={role()} canAdministerUsers={false} canManageOrgUnits={false} />,
    );
    expect(screen.getByText('Escopo organizacional')).toBeInTheDocument();
    expect(
      screen.getByText(/O escopo organizacional é concedido por usuário, não por este papel\./),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Gerenciar escopo organizacional' }),
    ).not.toBeInTheDocument();
    unmount();

    render(<RoleUsersTab role={role()} canAdministerUsers={false} canManageOrgUnits />);
    expect(screen.getByRole('link', { name: 'Gerenciar escopo organizacional' })).toHaveAttribute(
      'href',
      '/admin/organization',
    );
  });
});

const LARGE_TOTAL = 196;

function respondWithLargeDirectory(): void {
  listUsersMock.mockImplementation(({ page, pageSize }: { page: number; pageSize: number }) => {
    const start = (page - 1) * pageSize;
    const size = Math.max(0, Math.min(pageSize, LARGE_TOTAL - start));
    return Promise.resolve({
      data: Array.from({ length: size }, (_unused, index) =>
        adminUser({
          id: `u${start + index + 1}`,
          fullName: `Pessoa ${start + index + 1}`,
          email: `pessoa${start + index + 1}@example.local`,
        }),
      ),
      meta: { page, pageSize, total: LARGE_TOTAL, totalPages: Math.ceil(LARGE_TOTAL / pageSize) },
    });
  });
}

describe('RoleUsersTab — pagination above the contract cap (FR-024, NFR-006)', () => {
  it('turns the page with exactly one further request, and says which slice it is showing', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );

    expect(await screen.findByText('Pessoa 1')).toBeInTheDocument();
    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, roleId: 'role-1' });
    expect(screen.getByText('196 pessoas têm este papel')).toBeInTheDocument();
    expect(screen.getByText('1–10 de 196')).toBeInTheDocument();
    expect(screen.queryByText('Pessoa 11')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página 2' }));

    expect(await screen.findByText('Pessoa 11')).toBeInTheDocument();
    expect(screen.queryByText('Pessoa 1')).not.toBeInTheDocument();
    expect(screen.getByText('11–20 de 196')).toBeInTheDocument();
    expect(listUsersMock).toHaveBeenCalledTimes(2);
    expect(listUsersMock).toHaveBeenLastCalledWith({ page: 2, pageSize: 10, roleId: 'role-1' });
  });

  it('reaches the people past the old 100-person ceiling, on the last page', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );
    await screen.findByText('Pessoa 1');

    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página 5' }));
    await screen.findByText('Pessoa 41');
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página 20' }));

    expect(await screen.findByText('Pessoa 196')).toBeInTheDocument();
    expect(screen.getByText('191–196 de 196')).toBeInTheDocument();
    expect(listUsersMock).toHaveBeenCalledTimes(3);
    expect(listUsersMock).toHaveBeenLastCalledWith({ page: 20, pageSize: 10, roleId: 'role-1' });
  });

  it('returns to the first page when the page size changes, and never asks for more than the contract allows', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );
    await screen.findByText('Pessoa 1');
    fireEvent.click(screen.getByRole('button', { name: 'Ir para a página 3' }));
    await screen.findByText('Pessoa 21');

    fireEvent.change(screen.getByLabelText('Itens por página'), { target: { value: '100' } });

    expect(await screen.findByText('Pessoa 1')).toBeInTheDocument();
    expect(screen.getByText('1–100 de 196')).toBeInTheDocument();
    expect(listUsersMock).toHaveBeenLastCalledWith({ page: 1, pageSize: 100, roleId: 'role-1' });
    for (const call of listUsersMock.mock.calls) {
      expect((call[0] as { pageSize: number }).pageSize).toBeLessThanOrEqual(100);
    }
  });

  it('keeps the pagination control mounted and focused across a page turn', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );
    await screen.findByText('Pessoa 1');

    const secondPageButton = screen.getByRole('button', { name: 'Ir para a página 2' });
    secondPageButton.focus();
    fireEvent.click(secondPageButton);
    await screen.findByText('Pessoa 11');

    expect(screen.getByRole('button', { name: 'Ir para a página 1' })).toBeInTheDocument();
    expect(document.activeElement).toBe(secondPageButton);
  });

  it('offers no second page for a role that fits on one', async () => {
    listUsersMock.mockResolvedValue({
      data: [adminUser()],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    render(<RoleUsersTab role={role()} canAdministerUsers canManageOrgUnits={false} />);
    await screen.findByText('Ana Pereira');

    expect(screen.getByRole('button', { name: 'Ir para a página 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ir para a página 2' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Próxima página' })).toBeDisabled();
  });

  it('renders no pagination control at all for a role with no holders', async () => {
    listUsersMock.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 },
    });

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: 0 })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );

    expect(await screen.findByText('Nenhuma pessoa tem este papel.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Itens por página')).not.toBeInTheDocument();
  });
});

describe('RoleUsersTab — pagination opens no second path around user:administer (FR-018/FR-019/FR-020)', () => {
  it('WITHOUT user:administer: no request, no pagination control, no personal datum — at 196 holders', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers={false}
        canManageOrgUnits={false}
      />,
    );

    await waitFor(() => expect(listUsersMock).not.toHaveBeenCalled());
    expect(screen.queryByRole('button', { name: /Ir para a página/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Próxima página' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Itens por página')).not.toBeInTheDocument();

    expect(screen.getByText('196 pessoas têm este papel')).toBeInTheDocument();
    const markup = document.body.innerHTML;
    expect(markup).not.toContain('@example.local');
    expect(markup).not.toContain('Pessoa 1');
    expect(markup).not.toContain('Auditora Interna');
    expect(markup).not.toContain('Tecnologia da Informação');
  });

  it('WITH user:administer: the request IS made and the pagination control IS rendered — same role, same mock', async () => {
    respondWithLargeDirectory();

    render(
      <RoleUsersTab
        role={role({ assignedUserCount: LARGE_TOTAL })}
        canAdministerUsers
        canManageOrgUnits={false}
      />,
    );

    expect(await screen.findByText('Pessoa 1')).toBeInTheDocument();
    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ir para a página 2' })).toBeInTheDocument();
    expect(screen.getByLabelText('Itens por página')).toBeInTheDocument();
    expect(document.body.innerHTML).toContain('pessoa1@example.local');
  });
});
