import { describe, expect, it } from 'vitest';

import {
  applyRoleCriteria,
  roleMatchesCriteria,
  roleModuleReach,
  sortRoles,
} from './role-filtering';

import type { Permission, Role } from '../../types';

function permission(identifier: string, resource: string): Permission {
  return { identifier, resource, action: 'VIEW', description: identifier };
}

function role(overrides: Partial<Role> = {}): Role {
  return {
    id: 'r',
    name: 'Papel',
    description: 'Descrição',
    isSystem: false,
    assignedUserCount: 0,
    permissions: [],
    ...overrides,
  };
}

describe('roleModuleReach', () => {
  it('orders modules by how many permissions the role concentrates in each, not by product order', () => {
    const reach = roleModuleReach(
      role({
        permissions: [
          permission('risk:view', 'risk'),
          permission('finding:view', 'finding'),
          permission('finding:create', 'finding'),
          permission('audit-engagement:view', 'audit-engagement'),
        ],
      }),
    );

    expect(reach.map((module) => module.area)).toEqual(['audit', 'risk']);
    expect(reach[0]).toMatchObject({ label: 'Auditoria e achados', permissionCount: 3 });
    expect(reach[1]).toMatchObject({ label: 'Riscos', permissionCount: 1 });
  });

  it('breaks a tie by the platform order, so the list is stable between renders', () => {
    const reach = roleModuleReach(
      role({
        permissions: [permission('control:view', 'control'), permission('risk:view', 'risk')],
      }),
    );
    expect(reach.map((module) => module.area)).toEqual(['risk', 'control']);
  });

  it('reaches no module at all when the role grants nothing', () => {
    expect(roleModuleReach(role({ permissions: [] }))).toEqual([]);
  });
});

describe('roleMatchesCriteria', () => {
  const riskRole = role({
    id: 'risk',
    name: 'Analista de Riscos',
    description: 'Trata riscos operacionais.',
    permissions: [permission('risk:view', 'risk')],
  });

  it('matches the search term against the name and against the description, accent- and case-insensitively for case', () => {
    const criteria = { type: 'all', module: undefined } as const;
    expect(roleMatchesCriteria(riskRole, { ...criteria, q: 'analista' })).toBe(true);
    expect(roleMatchesCriteria(riskRole, { ...criteria, q: 'OPERACIONAIS' })).toBe(true);
    expect(roleMatchesCriteria(riskRole, { ...criteria, q: 'auditoria' })).toBe(false);
  });

  it('filters by kind', () => {
    const system = role({ isSystem: true });
    const custom = role({ isSystem: false });
    expect(roleMatchesCriteria(system, { q: '', type: 'system', module: undefined })).toBe(true);
    expect(roleMatchesCriteria(custom, { q: '', type: 'system', module: undefined })).toBe(false);
    expect(roleMatchesCriteria(custom, { q: '', type: 'custom', module: undefined })).toBe(true);
    expect(roleMatchesCriteria(system, { q: '', type: 'custom', module: undefined })).toBe(false);
  });

  it('matches a module when the role grants AT LEAST ONE of its permissions (FR-005a)', () => {
    expect(roleMatchesCriteria(riskRole, { q: '', type: 'all', module: 'risk' })).toBe(true);
    expect(roleMatchesCriteria(riskRole, { q: '', type: 'all', module: 'control' })).toBe(false);
  });

  it('never matches a module when the role grants no permission at all', () => {
    const empty = role({ permissions: [] });
    expect(roleMatchesCriteria(empty, { q: '', type: 'all', module: 'risk' })).toBe(false);
    expect(roleMatchesCriteria(empty, { q: '', type: 'all', module: undefined })).toBe(true);
  });

  it('finds a seeded role by its pt-BR name AND by its stored name (ADR-022)', () => {
    const seeded = role({
      id: 'pa',
      name: 'Platform Administrator',
      description: 'Acesso administrativo completo à plataforma.',
    });
    const criteria = { type: 'all', module: undefined } as const;

    expect(roleMatchesCriteria(seeded, { ...criteria, q: 'Administrador' })).toBe(true);
    expect(roleMatchesCriteria(seeded, { ...criteria, q: 'plataforma' })).toBe(true);
    expect(roleMatchesCriteria(seeded, { ...criteria, q: 'Platform' })).toBe(true);
    expect(roleMatchesCriteria(seeded, { ...criteria, q: 'administrator' })).toBe(true);

    expect(roleMatchesCriteria(seeded, { ...criteria, q: 'incidente' })).toBe(false);
  });

  it('does not let the pt-BR map leak into a custom role name', () => {
    const custom = role({ id: 'c', name: 'Equipe Alfa', description: 'Sem relação.' });
    expect(roleMatchesCriteria(custom, { q: 'Analista', type: 'all', module: undefined })).toBe(
      false,
    );
  });
});

describe('sortRoles', () => {
  const roles = [
    role({ id: 'b', name: 'Beta', assignedUserCount: 5, permissions: [] }),
    role({
      id: 'a',
      name: 'Alfa',
      assignedUserCount: 1,
      permissions: [permission('risk:view', 'risk'), permission('risk:edit', 'risk')],
    }),
    role({ id: 'c', name: 'Gama', assignedUserCount: 9, permissions: [] }),
  ];

  it('orders by name in both directions', () => {
    expect(sortRoles(roles, 'name:asc').map((r) => r.name)).toEqual(['Alfa', 'Beta', 'Gama']);
    expect(sortRoles(roles, 'name:desc').map((r) => r.name)).toEqual(['Gama', 'Beta', 'Alfa']);
  });

  it('orders by permission count, then by name so the result is total', () => {
    expect(sortRoles(roles, 'permissions:desc').map((r) => r.name)).toEqual([
      'Alfa',
      'Beta',
      'Gama',
    ]);
  });

  it('orders by assigned users', () => {
    expect(sortRoles(roles, 'users:desc').map((r) => r.name)).toEqual(['Gama', 'Beta', 'Alfa']);
  });

  it('does not mutate the array it was given', () => {
    const original = [...roles];
    sortRoles(roles, 'name:desc');
    expect(roles).toEqual(original);
  });

  it('orders A–Z by the name the list PRINTS, not by the one it stores (ADR-022)', () => {
    const seeded = [
      role({ id: '1', name: 'Audit Lead' }),
      role({ id: '2', name: 'Platform Administrator' }),
      role({ id: '3', name: 'Read Only' }),
    ];

    expect(sortRoles(seeded, 'name:asc').map((r) => r.name)).toEqual([
      'Platform Administrator',
      'Audit Lead',
      'Read Only',
    ]);
    expect(sortRoles(seeded, 'name:desc').map((r) => r.name)).toEqual([
      'Read Only',
      'Audit Lead',
      'Platform Administrator',
    ]);
  });
});

describe('applyRoleCriteria', () => {
  it('narrows first and orders what is left, so the results count matches what is listed', () => {
    const result = applyRoleCriteria(
      [
        role({
          id: '1',
          name: 'Zeta',
          isSystem: true,
          permissions: [permission('risk:view', 'risk')],
        }),
        role({
          id: '2',
          name: 'Alfa',
          isSystem: false,
          permissions: [permission('risk:view', 'risk')],
        }),
        role({
          id: '3',
          name: 'Beta',
          isSystem: true,
          permissions: [permission('risk:view', 'risk')],
        }),
      ],
      { q: '', type: 'system', module: 'risk' },
      'name:asc',
    );
    expect(result.map((r) => r.name)).toEqual(['Beta', 'Zeta']);
  });
});
