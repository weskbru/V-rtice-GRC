import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { UserAdminSummary } from './user-admin-summary';

const { listUsersMock, getRolesSummaryMock } = vi.hoisted(() => ({
  listUsersMock: vi.fn(),
  getRolesSummaryMock: vi.fn(),
}));

vi.mock('../../api', () => ({
  adminApi: { listUsers: listUsersMock, getRolesSummary: getRolesSummaryMock },
}));

function pageFixture(total: number): {
  data: never[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
} {
  return { data: [], meta: { total, page: 1, pageSize: 1, totalPages: total } };
}

beforeEach(() => {
  listUsersMock.mockReset();
  getRolesSummaryMock.mockReset();
});

describe('UserAdminSummary', () => {
  it('renders total, active and the derived inactive figure from two O(1) requests, with canManageRoles=false', async () => {
    listUsersMock.mockImplementation((query: { status?: string }) =>
      Promise.resolve(pageFixture(query.status === 'ACTIVE' ? 130 : 172)),
    );

    render(<UserAdminSummary canManageRoles={false} />);

    await waitFor(() => expect(screen.getByText('172')).toBeInTheDocument());
    expect(screen.getByText('130')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(getRolesSummaryMock).not.toHaveBeenCalled();
  });

  it('omits the "Sem papel" tile entirely when canManageRoles is false — never a zero, never a permanent skeleton', async () => {
    listUsersMock.mockResolvedValue(pageFixture(100));

    render(<UserAdminSummary canManageRoles={false} />);

    await waitFor(() => expect(screen.getByText('Total de usuários')).toBeInTheDocument());
    expect(screen.queryByText('Sem papel')).not.toBeInTheDocument();
  });

  it('renders "Sem papel" as total − usersWithRoles, and calls getRolesSummary, only when canManageRoles is true', async () => {
    listUsersMock.mockResolvedValue(pageFixture(100));
    getRolesSummaryMock.mockResolvedValueOnce({
      totalRoles: 12,
      systemRoles: 12,
      customRoles: 0,
      usersWithRoles: 91,
    });

    render(<UserAdminSummary canManageRoles={true} />);

    await waitFor(() => expect(screen.getByText('Sem papel')).toBeInTheDocument());
    expect(getRolesSummaryMock).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByText('9')).toBeInTheDocument());
  });

  it('links "Ativos" and "Inativos" into this register\'s own status filter, and never links "Sem papel"', async () => {
    listUsersMock.mockResolvedValue(pageFixture(50));
    getRolesSummaryMock.mockResolvedValueOnce({
      totalRoles: 5,
      systemRoles: 5,
      customRoles: 0,
      usersWithRoles: 40,
    });

    render(<UserAdminSummary canManageRoles={true} />);

    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: 'Filtrar o registro por usuários ativos' }),
      ).toHaveAttribute('href', '/admin/users?status=ACTIVE'),
    );
    expect(
      screen.getByRole('link', { name: 'Filtrar o registro por usuários inativos' }),
    ).toHaveAttribute('href', '/admin/users?status=INACTIVE');
    expect(screen.queryByRole('link', { name: /sem papel/i })).not.toBeInTheDocument();
  });

  it('degrades the whole strip to one quiet line, with no indicator cards, when a request fails', async () => {
    listUsersMock.mockRejectedValue(new Error('network down'));
    getRolesSummaryMock.mockResolvedValue({
      totalRoles: 1,
      systemRoles: 1,
      customRoles: 0,
      usersWithRoles: 1,
    });

    render(<UserAdminSummary canManageRoles={true} />);

    await waitFor(() =>
      expect(
        screen.getByText(
          'Não foi possível carregar os indicadores. A lista de usuários continua abaixo.',
        ),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
