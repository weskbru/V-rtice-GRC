import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

/**
 * Component-mount evidence for `RolePermissionsTab`
 * (015-roles-permissions-surface FR-013 to FR-017, T036/T037/T038).
 *
 * ## Migrated coverage (D-07, T049)
 *
 * `role-details-dialog.test.tsx` guarded the read-only permission list: the
 * "no permission" case, the area → resource → permission grouping with the
 * readable verb, the real identifier and the catalogue description, and —
 * the assertion that actually made it a READ surface — that no checkbox
 * exists in it. All of that lands here, on the tab that replaced the dialog.
 *
 * Two differences are deliberate, not lost coverage:
 *
 * - the identifier and the English catalogue description are now revealed on
 *   demand (FR-016/FR-017) instead of always printed, so the assertions run
 *   in both states of `showIdentifiers` and prove the identifier is REVEALED,
 *   never rewritten;
 * - modules start collapsed, so the list is expanded first. That is the
 *   disclosure FR-014 asks for, and "Expandir todos" is exercised as the
 *   documented way to open them all at once.
 */

import { RolePermissionsTab } from './role-permissions-tab';

import type { Permission, Role } from '../../types';

function permission(
  identifier: string,
  description: string,
  action: Permission['action'] = 'VIEW',
): Permission {
  const resource = identifier.slice(0, identifier.indexOf(':'));
  return { identifier, resource, action, description };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'role-1',
    name: 'Analista de Riscos',
    description: 'Analisa e trata riscos operacionais.',
    isSystem: false,
    assignedUserCount: 0,
    permissions: [],
    ...overrides,
  };
}

describe('RolePermissionsTab — the authorization model it states (FR-015, SC-003)', () => {
  it('says access is granted directly, that there is NO inheritance, and that effective access is a union', () => {
    render(<RolePermissionsTab role={role()} showIdentifiers={false} />);

    expect(screen.getByText('Como este papel concede acesso')).toBeInTheDocument();
    expect(
      screen.getByText('As permissões abaixo são concedidas diretamente por este papel.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Não há herança entre papéis: um papel nunca recebe permissões de outro.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'O acesso efetivo de uma pessoa é a união das permissões de todos os papéis atribuídos a ela.',
      ),
    ).toBeInTheDocument();
  });

  it('never uses "herdada de" or any other suggestion of hierarchy (SC-003)', () => {
    const { container } = render(
      <RolePermissionsTab
        role={role({
          permissions: [permission('risk:view', 'View risks'), permission('control:view', 'View')],
        })}
        showIdentifiers
      />,
    );
    // The real model is a flat union over directly assigned roles; the word
    // would describe a mechanism PharosGRC does not have anywhere.
    expect(container.textContent ?? '').not.toMatch(/herdad|hierarqui/i);
  });
});

describe('RolePermissionsTab — the granted permissions (migrated from RoleDetailsDialog)', () => {
  it('says the role grants nothing, rather than showing an empty module list', () => {
    render(<RolePermissionsTab role={role({ permissions: [] })} showIdentifiers={false} />);
    expect(screen.getByText('Este papel não concede nenhuma permissão.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Expandir todos' })).not.toBeInTheDocument();
  });

  it('groups by module with a per-module count, and opens every module at once (FR-013, FR-014)', () => {
    render(
      <RolePermissionsTab
        role={role({
          permissions: [
            permission('control:test', 'Test the effectiveness of the control', 'ASSESS'),
            permission('risk:view', 'View risks'),
            permission('risk:edit', 'Edit risks'),
          ],
        })}
        showIdentifiers={false}
      />,
    );

    expect(screen.getByRole('heading', { name: /Riscos/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Controles/ })).toBeInTheDocument();
    expect(screen.getByText('2 permissões')).toBeInTheDocument();
    expect(screen.getByText('1 permissão')).toBeInTheDocument();

    // Collapsed to begin with — the disclosure idiom of FR-014.
    expect(screen.queryByText('Testar')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Expandir todos' }));

    // The verb comes from the IDENTIFIER, never from the `action` field:
    // `control:test` carries `action = ASSESS`, and labelling by `action`
    // would print "Avaliar" for "Testar" (012 §2.3, kept by this phase).
    expect(screen.getByText('Testar')).toBeInTheDocument();
    expect(screen.getByText('Visualizar')).toBeInTheDocument();
    expect(screen.getByText('Editar')).toBeInTheDocument();

    // And it collapses again from the same control.
    fireEvent.click(screen.getByRole('button', { name: 'Recolher todos' }));
    expect(screen.queryByText('Testar')).not.toBeInTheDocument();
  });

  it('is a READ surface: it never renders a checkbox', () => {
    render(
      <RolePermissionsTab
        role={role({ permissions: [permission('risk:view', 'View risks')] })}
        showIdentifiers
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Expandir todos' }));
    // The assertion that separates reading a role from editing one — the
    // same guard `role-details-dialog.test.tsx` carried.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('reveals the real identifier and the catalogue description only on demand, and never rewrites them (FR-016, FR-017)', () => {
    const target = role({
      permissions: [permission('control:test', 'Test the effectiveness of the control', 'ASSESS')],
    });

    const { unmount } = render(<RolePermissionsTab role={target} showIdentifiers={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir todos' }));
    // The pt-BR label is the primary one and stands alone by default.
    expect(screen.getByText('Testar')).toBeInTheDocument();
    expect(screen.queryByText('control:test')).not.toBeInTheDocument();
    // F-63 — the API description is still English. It is secondary text and
    // must not be the primary reading.
    expect(screen.queryByText('Test the effectiveness of the control')).not.toBeInTheDocument();
    unmount();

    render(<RolePermissionsTab role={target} showIdentifiers />);
    fireEvent.click(screen.getByRole('button', { name: 'Expandir todos' }));
    expect(screen.getByText('Testar')).toBeInTheDocument();
    // Revealed EXACTLY as the platform stores it — never translated (§11.1).
    expect(screen.getByText('control:test')).toBeInTheDocument();
    expect(screen.getByText('Test the effectiveness of the control')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Os identificadores são os nomes técnicos usados pela plataforma e não podem ser alterados.',
      ),
    ).toBeInTheDocument();
  });
});
