import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Component-mount evidence for `RoleAdminView`, the roles and permissions
 * surface (015-roles-permissions-surface).
 *
 * `../../api` is mocked at the network boundary and permission gating goes
 * through the real `usePermissions`/`AuthProvider` stack with
 * `buildTestSession`, mirroring the established convention
 * (`report-catalog-view.test.tsx`, `permissions.test.tsx`).
 *
 * Three of these tests are security regressions, not UI checks, and each
 * fails if its protection is removed:
 *
 * - `role:administer` WITHOUT `user:administer` must produce no personal
 *   data at all — and, more strongly, no REQUEST for any (FR-018 to FR-020,
 *   SC-006). Asserting only "the e-mail is not on screen" would pass
 *   against an implementation that fetched the roster and hid it with CSS;
 *   asserting the request was never made is what closes that.
 * - a SYSTEM role's `PATCH` carries `description` and nothing else
 *   (FR-031). Sending `name` or `permissionIdentifiers`, even unchanged, is
 *   a 422 from the server — the defect
 *   `specs/012-admin-roles-screen/STATE.md` §3.1 measured and fixed, and a
 *   forbidden regression here.
 * - the number of requests on load is constant in the number of roles
 *   (SC-007, NFR-006).
 */

const {
  listRolesMock,
  getRolesSummaryMock,
  listPermissionsMock,
  listUsersMock,
  updateRoleMock,
  createRoleMock,
  deleteRoleMock,
  navigation,
} = vi.hoisted(() => ({
  listRolesMock: vi.fn(),
  getRolesSummaryMock: vi.fn(),
  listPermissionsMock: vi.fn(),
  listUsersMock: vi.fn(),
  updateRoleMock: vi.fn(),
  createRoleMock: vi.fn(),
  deleteRoleMock: vi.fn(),
  navigation: { search: '', listeners: new Set<() => void>() },
}));

// A working stand-in for the App Router's query string: `useSearchParams`
// subscribes to it, and `router.replace` writes it and notifies. Without
// the notification the filter controls would appear inert in tests for a
// reason that has nothing to do with the screen.
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const subscribe = (onStoreChange: () => void): (() => void) => {
    navigation.listeners.add(onStoreChange);
    return () => navigation.listeners.delete(onStoreChange);
  };
  const getSnapshot = (): string => navigation.search;
  return {
    usePathname: () => '/admin/roles',
    useSearchParams: () =>
      new URLSearchParams(useSyncExternalStore(subscribe, getSnapshot, getSnapshot)),
    useRouter: () => ({
      replace: (url: string) => {
        const index = url.indexOf('?');
        navigation.search = index === -1 ? '' : url.slice(index + 1);
        for (const listener of navigation.listeners) listener();
      },
    }),
  };
});

vi.mock('../../api', () => ({
  adminApi: {
    listRoles: listRolesMock,
    getRolesSummary: getRolesSummaryMock,
    listPermissions: listPermissionsMock,
    listUsers: listUsersMock,
    updateRole: updateRoleMock,
    createRole: createRoleMock,
    deleteRole: deleteRoleMock,
  },
}));

import { AuthProvider } from '@/lib/auth-context';
import { buildTestSession } from '@/lib/test-fixtures/session';

import { RoleAdminView } from './role-admin-view';

import type { Permission, Role, RolesSummary } from '../../types';
import type { CurrentSession } from '@/lib/auth-types';

function permission(identifier: string, resource: string): Permission {
  return {
    identifier,
    resource,
    action: 'VIEW',
    description: `Description of ${identifier}`,
  };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Analista de Riscos',
    description: 'Analisa e trata riscos operacionais em sua unidade.',
    isSystem: false,
    assignedUserCount: 0,
    permissions: [permission('risk:view', 'risk')],
    ...overrides,
  };
}

function summary(overrides: Partial<RolesSummary> = {}): RolesSummary {
  return { totalRoles: 1, systemRoles: 0, customRoles: 1, usersWithRoles: 0, ...overrides };
}

function resolveRoles(roles: readonly Role[]): void {
  listRolesMock.mockResolvedValue({
    data: roles,
    meta: { page: 1, pageSize: 100, total: roles.length, totalPages: 1 },
  });
}

/**
 * Radix's `Tabs` selects on `mousedown` (and on focus, in its default
 * automatic activation mode) — never on a bare `click`, which `fireEvent`
 * dispatches on its own. A test that only clicks would assert against the
 * tab that was already open and pass for the wrong reason.
 */
function selectTab(container: HTMLElement, name: string): void {
  const tab = within(container).getByRole('tab', { name });
  fireEvent.mouseDown(tab, { button: 0 });
  fireEvent.click(tab);
}

function renderView(session?: Partial<CurrentSession>): void {
  render(
    <AuthProvider initialSession={buildTestSession(session)}>
      <RoleAdminView />
    </AuthProvider>,
  );
}

beforeEach(() => {
  listRolesMock.mockReset();
  getRolesSummaryMock.mockReset();
  listPermissionsMock.mockReset();
  listUsersMock.mockReset();
  updateRoleMock.mockReset();
  createRoleMock.mockReset();
  deleteRoleMock.mockReset();
  navigation.search = '';
  navigation.listeners.clear();
  getRolesSummaryMock.mockResolvedValue(summary());
  listPermissionsMock.mockResolvedValue([]);
});

describe('RoleAdminView — indicators', () => {
  it('renders the four indicators from the summary endpoint, not from the loaded page', async () => {
    resolveRoles([role({ id: 'r1' })]);
    getRolesSummaryMock.mockResolvedValue({
      totalRoles: 12,
      systemRoles: 9,
      customRoles: 3,
      // Deliberately unequal to anything derivable from the one loaded role:
      // this figure is `COUNT(DISTINCT user_id)` and has no other source.
      usersWithRoles: 7,
    });

    renderView({ permissions: ['role:administer'] });

    const indicators = await screen.findByRole('region', {
      name: 'Resumo de papéis e permissões',
    });
    expect(within(indicators).getByText('12')).toBeInTheDocument();
    expect(within(indicators).getByText('9')).toBeInTheDocument();
    expect(within(indicators).getByText('3')).toBeInTheDocument();
    expect(within(indicators).getByText('7')).toBeInTheDocument();
  });

  it('applies the kind filter from the indicator, marks it pressed, and leaves the fourth indicator inert', async () => {
    resolveRoles([
      role({ id: 'r1', name: 'Papel de sistema', isSystem: true }),
      role({ id: 'r2', name: 'Papel personalizado', isSystem: false }),
    ]);

    renderView({ permissions: ['role:administer'] });

    await screen.findByText('Papel personalizado');

    const systemIndicator = screen.getByRole('button', {
      name: /Mostrar somente os papéis do sistema/,
    });
    expect(systemIndicator).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(systemIndicator);

    await waitFor(() => expect(screen.queryByText('Papel personalizado')).not.toBeInTheDocument());
    expect(screen.getByText('Papel de sistema')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Mostrar somente os papéis do sistema/ }),
    ).toHaveAttribute('aria-pressed', 'true');

    // FR-003 — "Usuários com papéis" is not a filter and must not be a control.
    expect(screen.queryByRole('button', { name: /Usuários com papéis/ })).not.toBeInTheDocument();
  });

  it('keeps the roles list when the indicators fail to load', async () => {
    resolveRoles([role({ id: 'r1', name: 'Analista de Riscos' })]);
    getRolesSummaryMock.mockRejectedValue(new Error('boom'));

    renderView({ permissions: ['role:administer'] });

    expect(
      await screen.findByText(
        'Não foi possível carregar os indicadores. A lista de papéis continua abaixo.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByText('Analista de Riscos')).toBeInTheDocument();
  });
});

describe('RoleAdminView — list', () => {
  it('issues a constant number of requests regardless of how many roles come back (SC-007)', async () => {
    resolveRoles(
      Array.from({ length: 12 }, (_, index) =>
        role({ id: `r${index}`, name: `Papel ${index}`, assignedUserCount: index }),
      ),
    );

    renderView({ permissions: ['role:administer'] });

    await screen.findByText('Papel 0');
    expect(listRolesMock).toHaveBeenCalledTimes(1);
    expect(getRolesSummaryMock).toHaveBeenCalledTimes(1);
    expect(listUsersMock).not.toHaveBeenCalled();
    expect(listPermissionsMock).not.toHaveBeenCalled();
  });

  it('shows the "no role exists" state when the platform has none', async () => {
    resolveRoles([]);
    renderView({ permissions: ['role:administer'] });
    expect(await screen.findByText('Nenhum papel cadastrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum papel encontrado')).not.toBeInTheDocument();
  });

  it('shows the distinct "nothing matched" state when filters exclude every role', async () => {
    resolveRoles([role({ id: 'r1', name: 'Papel de sistema', isSystem: true })]);
    navigation.search = 'type=custom';
    renderView({ permissions: ['role:administer'] });

    expect(await screen.findByText('Nenhum papel encontrado')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum papel cadastrado')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Limpar filtros' }).length).toBeGreaterThan(0);
  });

  /**
   * The results strip, in the shape every register uses: the count on the
   * left with `role="status"`, and the ordering control beside it — NOT
   * behind the "Filtros" disclosure, because ordering reorders and never
   * hides a role, and the badge on that button does not count it.
   */
  it('reports the result count and offers the ordering outside the filters disclosure', async () => {
    resolveRoles([
      role({ id: 'r1', name: 'Papel de sistema', isSystem: true }),
      role({ id: 'r2', name: 'Papel personalizado', isSystem: false }),
    ]);

    renderView({ permissions: ['role:administer'] });

    await screen.findByText('Papel personalizado');
    expect(screen.getByRole('status')).toHaveTextContent('2 papéis');

    // The filters panel is closed, and the ordering is reachable anyway.
    const filtersToggle = screen.getByRole('button', { name: /^Filtros/ });
    expect(filtersToggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('combobox', { name: 'Ordenar por' })).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Tipo' })).not.toBeInTheDocument();
  });

  it('says how many of the total a filter left, and offers the fields behind the toggle', async () => {
    resolveRoles([
      role({ id: 'r1', name: 'Papel de sistema', isSystem: true }),
      role({ id: 'r2', name: 'Papel personalizado', isSystem: false }),
    ]);
    navigation.search = 'type=system';

    renderView({ permissions: ['role:administer'] });

    await screen.findByText('Papel de sistema');
    expect(screen.getByRole('status')).toHaveTextContent('1 de 2 papéis');

    // The chip is visible with the panel shut — what is hidden is the
    // machinery, never the state.
    const chips = screen.getByRole('group', { name: 'Filtros ativos' });
    expect(within(chips).getByText('Tipo: Sistema')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Filtros/ })).toHaveAccessibleName(/1/);
  });

  it('reorders the loaded page from the toolbar, and writes the ordering to the query string', async () => {
    resolveRoles([
      role({ id: 'r1', name: 'Alfa', permissions: [permission('risk:view', 'risk')] }),
      role({
        id: 'r2',
        name: 'Beta',
        permissions: [permission('risk:view', 'risk'), permission('risk:create', 'risk')],
      }),
    ]);

    renderView({ permissions: ['role:administer'] });

    const list = await screen.findByRole('list', { name: 'Papéis da plataforma' });
    const namesAsc = within(list)
      .getAllByRole('button', { name: /Abrir detalhes do papel/ })
      .map((button) => button.textContent ?? '');
    expect(namesAsc[0]).toContain('Alfa');

    // Radix `Select` cannot be driven by `fireEvent` in jsdom (it needs
    // pointer capture), so the ordering is exercised through the same URL
    // parameter the control writes — which is the state itself, not a
    // stand-in for it.
    navigation.search = 'sort=permissions%3Adesc';
    for (const listener of navigation.listeners) listener();

    await waitFor(() => {
      const reordered = within(screen.getByRole('list', { name: 'Papéis da plataforma' }))
        .getAllByRole('button', { name: /Abrir detalhes do papel/ })
        .map((button) => button.textContent ?? '');
      expect(reordered[0]).toContain('Beta');
    });
  });

  it('shows "Novo papel" only to a caller holding role:administer', async () => {
    resolveRoles([role()]);

    renderView({ permissions: [] });
    await screen.findByText('Analista de Riscos');
    expect(screen.queryByRole('button', { name: 'Novo papel' })).not.toBeInTheDocument();
  });
});

describe('RoleAdminView — detail panel', () => {
  it('opens the panel with the full description and the three counts, and returns focus to the card on close', async () => {
    const target = role({
      id: 'r1',
      name: 'Analista de Riscos',
      description:
        'Descrição longa o suficiente para nunca aparecer truncada com reticências no cartão, mas visível por completo no painel de detalhes.',
      assignedUserCount: 4,
      permissions: [
        permission('risk:view', 'risk'),
        permission('risk:create', 'risk'),
        permission('control:view', 'control'),
      ],
    });
    resolveRoles([target]);

    renderView({ permissions: ['role:administer'] });

    const card = await screen.findByRole('button', {
      name: /Abrir detalhes do papel Analista de Riscos/,
    });
    card.focus();
    fireEvent.click(card);

    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    expect(within(panel).getByText(target.description)).toBeInTheDocument();
    // The three counts of FR-011: 3 permissions, 4 users, 2 modules.
    expect(within(panel).getByText('3')).toBeInTheDocument();
    expect(within(panel).getByText('4')).toBeInTheDocument();
    expect(within(panel).getByText('2')).toBeInTheDocument();

    within(panel).getByRole('button', { name: 'Fechar detalhes do papel' }).click();

    await waitFor(() =>
      expect(
        screen.queryByRole('complementary', { name: 'Detalhes do papel' }),
      ).not.toBeInTheDocument(),
    );
    const cardAfterClose = screen.getByRole('button', {
      name: /Abrir detalhes do papel Analista de Riscos/,
    });
    expect(cardAfterClose).toBe(card);
    expect(document.activeElement).toBe(card);
  });

  it('states the real authorization model and never suggests inheritance (SC-003)', async () => {
    resolveRoles([role({ id: 'r1' })]);
    renderView({ permissions: ['role:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );

    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    expect(
      within(panel).getByText(
        'Não há herança entre papéis: um papel nunca recebe permissões de outro.',
      ),
    ).toBeInTheDocument();
    expect(panel.textContent ?? '').not.toMatch(/herdad/i);
  });

  it('reveals the real identifiers on demand and never rewrites them (FR-016)', async () => {
    resolveRoles([role({ id: 'r1', permissions: [permission('risk:view', 'risk')] })]);
    renderView({ permissions: ['role:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });

    fireEvent.click(within(panel).getByRole('button', { name: 'Expandir todos' }));
    expect(within(panel).queryByText('risk:view')).not.toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Ver identificadores técnicos' }));
    expect(within(panel).getByText('risk:view')).toBeInTheDocument();
  });
});

describe('RoleAdminView — Users tab and its permission boundary', () => {
  it('never requests nor renders personal data without user:administer (FR-018/FR-020, SC-006)', async () => {
    resolveRoles([role({ id: 'r1', assignedUserCount: 3 })]);
    // Would leak a name, an e-mail, a job title and a unit if it were ever
    // called. It must not be.
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: 'u1',
          email: 'ana.pereira@example.local',
          fullName: 'Ana Pereira',
          jobTitle: 'Auditora',
          status: 'ACTIVE',
          primaryOrgUnit: { id: 'o1', code: 'TI', name: 'Tecnologia' },
          roles: [{ id: 'r1', name: 'Analista de Riscos' }],
          authenticationMethods: ['LOCAL'],
          lastLoginAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    renderView({ permissions: ['role:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    selectTab(panel, 'Usuários');

    expect(await within(panel).findByText('Relação de pessoas indisponível')).toBeInTheDocument();
    expect(within(panel).getByText('3 pessoas têm este papel')).toBeInTheDocument();

    // The aggregate count is legitimate; everything below is not.
    expect(listUsersMock).not.toHaveBeenCalled();
    const markup = document.body.innerHTML;
    expect(markup).not.toContain('Ana Pereira');
    expect(markup).not.toContain('ana.pereira@example.local');
    expect(markup).not.toContain('Auditora');
    expect(markup).not.toContain('Tecnologia');
  });

  it('lists the people holding the role with user:administer, in one request (FR-021/FR-024)', async () => {
    resolveRoles([role({ id: 'r1', assignedUserCount: 1 })]);
    listUsersMock.mockResolvedValue({
      data: [
        {
          id: 'u1',
          email: 'ana.pereira@example.local',
          fullName: 'Ana Pereira',
          jobTitle: 'Auditora',
          status: 'ACTIVE',
          primaryOrgUnit: { id: 'o1', code: 'TI', name: 'Tecnologia' },
          roles: [
            { id: 'r1', name: 'Analista de Riscos' },
            { id: 'r2', name: 'Audit Lead' },
          ],
          authenticationMethods: ['LOCAL'],
          lastLoginAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      meta: { page: 1, pageSize: 10, total: 1, totalPages: 1 },
    });

    renderView({ permissions: ['role:administer', 'user:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    selectTab(panel, 'Usuários');

    expect(await within(panel).findByText('Ana Pereira')).toBeInTheDocument();
    expect(within(panel).getByText('ana.pereira@example.local')).toBeInTheDocument();
    // FR-025 — the other role is provenance of access, never inheritance.
    // ADR-022 — and it is named in pt-BR here, exactly as in the list.
    expect(within(panel).getByText('Líder de Auditoria')).toBeInTheDocument();
    expect(panel.textContent ?? '').not.toMatch(/herdad/i);

    expect(listUsersMock).toHaveBeenCalledTimes(1);
    expect(listUsersMock).toHaveBeenCalledWith({ page: 1, pageSize: 10, roleId: 'r1' });
  });
});

describe('RoleAdminView — editing', () => {
  /**
   * F-68 — this test used to be "sends ONLY the description when saving a
   * system role", which is the behaviour the finding condemned: the seed
   * reconciles `description` on every run, so the product wrote a field it
   * did not own and the audit trail recorded an edit the database did not
   * keep. It is replaced by a STRICTLY STRONGER claim — the screen offers no
   * save for a system role and issues no `PATCH` at all — which subsumes the
   * old one (a request that is never made cannot carry the wrong body) and
   * also subsumes `012 §3.1`, the defect where the unchanged permission set
   * travelled along and made every save fail.
   */
  it('offers NO save for a system role and never PATCHes one (F-68, FR-031)', async () => {
    const systemRole = role({
      id: 'r1',
      name: 'Platform Administrator',
      isSystem: true,
      permissions: [permission('role:administer', 'role')],
    });
    resolveRoles([systemRole]);
    updateRoleMock.mockResolvedValue({ ...systemRole, description: 'Nova descrição.' });

    renderView({ permissions: ['role:administer'] });

    // ADR-022 — the card is opened by the pt-BR label, because that is what
    // the card prints. The role's stored `name` is still 'Platform
    // Administrator', and the request asserted at the end of this test proves
    // the stored value is what travels to the server.
    fireEvent.click(
      await screen.findByRole('button', {
        name: /Abrir detalhes do papel Administrador da Plataforma/,
      }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });

    // There is no "Editar papel" for a system role — nothing about it is
    // editable, so the panel must not offer the word.
    expect(within(panel).queryByRole('button', { name: 'Editar papel' })).not.toBeInTheDocument();
    expect(
      within(panel).getByText(
        'Nome, descrição e permissões são definidos pela plataforma e não podem ser alterados aqui.',
      ),
    ).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Ver definição' }));

    // The locked name field shows the STORED name, never the label: it is the
    // value a save would have carried, and a system role's is unchangeable.
    expect(within(panel).getByLabelText(/^Nome/)).toHaveValue('Platform Administrator');

    // The reason is written out, not merely enforced by a dimmed control.
    expect(
      await within(panel).findByText('Papel do sistema: o nome não pode ser alterado.'),
    ).toBeInTheDocument();
    // Read-only rather than disabled: FR-031 asks for a LEGIBLE locked
    // field, and a disabled input is dimmed and dropped from the tab order.
    expect(within(panel).getByLabelText(/^Nome/)).toHaveAttribute('readonly');
    expect(within(panel).getByLabelText(/^Descrição/)).toHaveAttribute('readonly');

    // No save control exists in this state, under any of its labels.
    expect(
      within(panel).queryByRole('button', { name: 'Salvar alterações' }),
    ).not.toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Salvando…' })).not.toBeInTheDocument();
    expect(within(panel).getByRole('button', { name: 'Voltar' })).toBeInTheDocument();

    // Editing the description programmatically — which `fireEvent.change`
    // does whatever `readOnly` says — still produces no request, because
    // there is nothing to press and the hook refuses a locked target anyway.
    fireEvent.change(within(panel).getByLabelText(/^Descrição/), {
      target: { value: 'Nova descrição.' },
    });
    expect(updateRoleMock).not.toHaveBeenCalled();

    // No permission catalogue request either: a system role cannot change
    // its permissions, so fetching the catalogue would buy nothing.
    expect(listPermissionsMock).not.toHaveBeenCalled();

    // "Voltar" leaves the sheet and persists nothing.
    fireEvent.click(within(panel).getByRole('button', { name: 'Voltar' }));
    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'Ver definição' })).toBeInTheDocument(),
    );
    expect(updateRoleMock).not.toHaveBeenCalled();
  });

  it('summarises the pending change and sends the full payload for a custom role (FR-029)', async () => {
    const customRole = role({
      id: 'r1',
      name: 'Analista de Riscos',
      isSystem: false,
      permissions: [permission('risk:view', 'risk')],
    });
    resolveRoles([customRole]);
    listPermissionsMock.mockResolvedValue([
      permission('risk:view', 'risk'),
      permission('risk:create', 'risk'),
    ]);
    updateRoleMock.mockResolvedValue(customRole);

    renderView({ permissions: ['role:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Editar papel' }));

    const moduleToggle = await within(panel).findByRole('checkbox', {
      name: 'Selecionar todas as permissões de Riscos',
    });
    // One of two selected: partial, and said in words as well as in shape.
    expect(moduleToggle).toHaveAttribute('aria-checked', 'mixed');
    expect(within(panel).getByText('1 de 2 selecionadas')).toBeInTheDocument();

    fireEvent.click(moduleToggle);
    expect(await within(panel).findByText('1 permissão a acrescentar')).toBeInTheDocument();
    expect(within(panel).getByText('Todas selecionadas')).toBeInTheDocument();

    fireEvent.click(within(panel).getByRole('button', { name: 'Salvar alterações' }));

    await waitFor(() => expect(updateRoleMock).toHaveBeenCalledTimes(1));
    expect(updateRoleMock).toHaveBeenCalledWith('r1', {
      name: 'Analista de Riscos',
      description: customRole.description,
      permissionIdentifiers: ['risk:view', 'risk:create'],
    });
  });

  it('persists nothing when the edit is cancelled (FR-032)', async () => {
    const customRole = role({ id: 'r1', isSystem: false });
    resolveRoles([customRole]);
    listPermissionsMock.mockResolvedValue([permission('risk:view', 'risk')]);

    renderView({ permissions: ['role:administer'] });

    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    const panel = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Editar papel' }));

    fireEvent.change(await within(panel).findByLabelText(/^Descrição/), {
      target: { value: 'Alteração que não deve ser gravada.' },
    });
    fireEvent.click(within(panel).getByRole('button', { name: 'Cancelar' }));

    // A discarded edit is confirmed first, because the change is not
    // recoverable once dropped.
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar alterações' }));

    await waitFor(() =>
      expect(within(panel).getByRole('button', { name: 'Editar papel' })).toBeInTheDocument(),
    );
    expect(updateRoleMock).not.toHaveBeenCalled();
  });
});

/**
 * Creating a role (Fase 1 de "Novo papel"). What the retired
 * `RoleCreateDialog` did from a modal, the screen now does in the same panel
 * it reads and edits in — so the assertions below are about the SCREEN's
 * part of that: which panel is open, what the catalogue costs, and where the
 * user lands afterwards. The form itself is guarded in
 * `role-create-panel.test.tsx`.
 */
describe('RoleAdminView — creating a role', () => {
  it('opens the create panel from "Novo papel", and only then asks for the catalogue', async () => {
    resolveRoles([role()]);
    listPermissionsMock.mockResolvedValue([permission('risk:view', 'risk')]);

    renderView({ permissions: ['role:administer'] });
    await screen.findByText('Analista de Riscos');

    // Nothing is fetched for a screen nobody is composing on (SC-007).
    expect(listPermissionsMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('complementary', { name: 'Novo papel' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Novo papel' }));

    expect(await screen.findByRole('complementary', { name: 'Novo papel' })).toBeInTheDocument();
    await waitFor(() => expect(listPermissionsMock).toHaveBeenCalledTimes(1));
  });

  it('keeps one panel open at a time: composing clears the selection, selecting closes composition', async () => {
    resolveRoles([role({ id: 'r1', name: 'Analista de Riscos' })]);
    listPermissionsMock.mockResolvedValue([permission('risk:view', 'risk')]);

    renderView({ permissions: ['role:administer'] });
    fireEvent.click(
      await screen.findByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    expect(
      await screen.findByRole('complementary', { name: 'Detalhes do papel' }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Novo papel' }));
    expect(await screen.findByRole('complementary', { name: 'Novo papel' })).toBeInTheDocument();
    expect(
      screen.queryByRole('complementary', { name: 'Detalhes do papel' }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Abrir detalhes do papel Analista de Riscos/ }),
    );
    expect(
      await screen.findByRole('complementary', { name: 'Detalhes do papel' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Novo papel' })).not.toBeInTheDocument();
  });

  it('reloads the list and opens the new role once it is created, rather than leaving the user to find it', async () => {
    const created = role({
      id: 'r2',
      name: 'Leitor de Riscos',
      description: 'Só leitura de riscos.',
    });
    resolveRoles([role({ id: 'r1' })]);
    listPermissionsMock.mockResolvedValue([permission('risk:view', 'risk')]);
    createRoleMock.mockResolvedValue(created);

    renderView({ permissions: ['role:administer'] });
    await screen.findByText('Analista de Riscos');
    fireEvent.click(screen.getByRole('button', { name: 'Novo papel' }));

    const panel = await screen.findByRole('complementary', { name: 'Novo papel' });
    fireEvent.change(within(panel).getByLabelText(/^Nome/), {
      target: { value: 'Leitor de Riscos' },
    });
    fireEvent.change(within(panel).getByLabelText(/^Descrição/), {
      target: { value: 'Só leitura de riscos.' },
    });
    fireEvent.click(
      await within(panel).findByRole('checkbox', {
        name: 'Selecionar todas as permissões de Riscos',
      }),
    );

    // The listing answers with the new role on the reload the save triggers.
    resolveRoles([role({ id: 'r1' }), created]);
    fireEvent.click(within(panel).getByRole('button', { name: 'Criar papel' }));

    await waitFor(() => expect(createRoleMock).toHaveBeenCalledTimes(1));
    expect(createRoleMock).toHaveBeenCalledWith({
      name: 'Leitor de Riscos',
      description: 'Só leitura de riscos.',
      permissionIdentifiers: ['risk:view'],
    });

    // Composition is over, and the panel is now READING what was created.
    await waitFor(() =>
      expect(screen.queryByRole('complementary', { name: 'Novo papel' })).not.toBeInTheDocument(),
    );
    const detail = await screen.findByRole('complementary', { name: 'Detalhes do papel' });
    expect(within(detail).getByText('Leitor de Riscos')).toBeInTheDocument();
  });

  it('never renders the create panel for a caller without role:administer', async () => {
    resolveRoles([role()]);

    renderView({ permissions: ['role:view'] });
    await screen.findByText('Analista de Riscos');

    expect(screen.queryByRole('button', { name: 'Novo papel' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Novo papel' })).not.toBeInTheDocument();
    expect(listPermissionsMock).not.toHaveBeenCalled();
  });
});
