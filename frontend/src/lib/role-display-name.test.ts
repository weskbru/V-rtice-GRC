import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';
import { profile } from '@/lib/messages/profile';

import { roleDisplayName } from './role-display-name';

describe('roleDisplayName', () => {
  it('gives each of the twelve seeded roles its pt-BR name', () => {
    expect(roleDisplayName('Platform Administrator')).toBe('Administrador da Plataforma');
    expect(roleDisplayName('Risk Manager')).toBe('Gestor de Riscos');
    expect(roleDisplayName('Risk Analyst')).toBe('Analista de Riscos');
    expect(roleDisplayName('Risk Approver')).toBe('Aprovador de Riscos');
    expect(roleDisplayName('Control Owner')).toBe('Responsável por Controle');
    expect(roleDisplayName('Control Approver')).toBe('Aprovador de Controle');
    expect(roleDisplayName('Compliance Manager')).toBe('Gestor de Compliance');
    expect(roleDisplayName('Auditor')).toBe('Auditor');
    expect(roleDisplayName('Read Only')).toBe('Somente Leitura');
    expect(roleDisplayName('Audit Lead')).toBe('Líder de Auditoria');
    expect(roleDisplayName('Incident Manager')).toBe('Gestor de Incidentes');
    expect(roleDisplayName('Problem Manager')).toBe('Gestor de Problemas');
  });

  it('returns a custom role name exactly as it is stored', () => {
    expect(roleDisplayName('Analista de Riscos e Controles')).toBe(
      'Analista de Riscos e Controles',
    );
    expect(roleDisplayName('Auditoria Interna — Filial SP')).toBe('Auditoria Interna — Filial SP');
    expect(roleDisplayName('platform administrator')).toBe('platform administrator');
    expect(roleDisplayName('Platform Administrator ')).toBe('Platform Administrator ');
    expect(roleDisplayName('')).toBe('');
  });

  it('is not fooled by a custom role named after an Object.prototype member', () => {
    expect(roleDisplayName('constructor')).toBe('constructor');
    expect(roleDisplayName('toString')).toBe('toString');
    expect(roleDisplayName('valueOf')).toBe('valueOf');
    expect(roleDisplayName('__proto__')).toBe('__proto__');
    expect(roleDisplayName('hasOwnProperty')).toBe('hasOwnProperty');
  });

  it('maps exactly the twelve seeded names — the catalogue has no extra entry', () => {
    expect(Object.keys(common.roleDisplayNames)).toHaveLength(12);
  });

  it('never maps two seeded roles onto the same label', () => {
    const labels = Object.values(common.roleDisplayNames);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

describe('the Perfil catalogue no longer exists', () => {
  it('has no role map of its own', () => {
    expect(Object.hasOwn(profile.identity, 'roleLabels')).toBe(false);
  });

  it('still carries the rest of the identity card, so the assertion above is not vacuous', () => {
    expect(profile.identity.roles).toBe('Papéis');
    expect(profile.identity.noRolesAssigned).toBe('Nenhum atribuído');
  });

  it('resolves, through the one catalogue, the six roles that used to render in English there', () => {
    expect(roleDisplayName('Audit Lead')).toBe('Líder de Auditoria');
    expect(roleDisplayName('Compliance Manager')).toBe('Gestor de Compliance');
    expect(roleDisplayName('Control Owner')).toBe('Responsável por Controle');
    expect(roleDisplayName('Control Approver')).toBe('Aprovador de Controle');
    expect(roleDisplayName('Incident Manager')).toBe('Gestor de Incidentes');
    expect(roleDisplayName('Problem Manager')).toBe('Gestor de Problemas');
  });
});
