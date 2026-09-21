import { describe, expect, it } from 'vitest';

import { common } from '@/lib/messages/common';
import { profile } from '@/lib/messages/profile';

import { roleDisplayName } from './role-display-name';

/**
 * The two halves of ADR-022, asserted separately because they are opposite
 * behaviours that happen to share a function:
 *
 * 1. a SEEDED role name resolves to its pt-BR label;
 * 2. ANY other name — a role somebody created through the admin screens —
 *    comes back exactly as it went in.
 *
 * (2) is the half that is easy to break while (1) stays green, so it is
 * asserted on the awkward inputs as well as the ordinary one.
 */
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
    // A name a person typed. No translation exists, none is invented, and
    // nothing is trimmed, cased or "corrected".
    expect(roleDisplayName('Analista de Riscos e Controles')).toBe(
      'Analista de Riscos e Controles',
    );
    expect(roleDisplayName('Auditoria Interna — Filial SP')).toBe('Auditoria Interna — Filial SP');
    expect(roleDisplayName('platform administrator')).toBe('platform administrator');
    expect(roleDisplayName('Platform Administrator ')).toBe('Platform Administrator ');
    expect(roleDisplayName('')).toBe('');
  });

  it('is not fooled by a custom role named after an Object.prototype member', () => {
    // `map[name] ?? name` would return the inherited function here, and the
    // screen would print its source where a role name belongs.
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
    // Two roles sharing a label would be indistinguishable in the list, in
    // the Users register's chips and in the "Outros papéis" line.
    const labels = Object.values(common.roleDisplayNames);
    expect(new Set(labels).size).toBe(labels.length);
  });
});

/**
 * The predecessor of this guard asserted that `profile.identity.roleLabels`
 * and `admin.roles.displayNames` never DISAGREED — the weaker rule, chosen
 * honestly, because the Perfil catalogue covered six of the twelve seeded
 * roles and requiring it to be complete would have asserted a fix that phase
 * had not made.
 *
 * The fix is made. There is one catalogue, `common.roleDisplayNames`, and the
 * Perfil screen resolves through the same `roleDisplayName` as Administração
 * (`profile-view.tsx`). So the rule this file asserts is now the strong one:
 * the second map is GONE, and cannot come back here unnoticed.
 *
 * The structural half — no OTHER production file keying an object by a seeded
 * role name — is `role-display-name.single-catalogue.test.ts`, which reads the
 * source tree; this one only has to state the specific thing that was wrong.
 */
describe('the Perfil catalogue no longer exists', () => {
  it('has no role map of its own', () => {
    // `profile.identity.roleLabels` was the second catalogue. If it ever
    // returns, `roleLabels` is the name it would return under.
    expect(Object.hasOwn(profile.identity, 'roleLabels')).toBe(false);
  });

  it('still carries the rest of the identity card, so the assertion above is not vacuous', () => {
    // A `profile.identity` that had been emptied, renamed or broken would
    // make the check above pass for the wrong reason.
    expect(profile.identity.roles).toBe('Papéis');
    expect(profile.identity.noRolesAssigned).toBe('Nenhum atribuído');
  });

  it('resolves, through the one catalogue, the six roles that used to render in English there', () => {
    // These six were seeded after `profile.identity.roleLabels` was written
    // and were never added to it, so the Perfil screen printed their stored
    // English `Role.name`. They are the measurable half of this change.
    expect(roleDisplayName('Audit Lead')).toBe('Líder de Auditoria');
    expect(roleDisplayName('Compliance Manager')).toBe('Gestor de Compliance');
    expect(roleDisplayName('Control Owner')).toBe('Responsável por Controle');
    expect(roleDisplayName('Control Approver')).toBe('Aprovador de Controle');
    expect(roleDisplayName('Incident Manager')).toBe('Gestor de Incidentes');
    expect(roleDisplayName('Problem Manager')).toBe('Gestor de Problemas');
  });
});
