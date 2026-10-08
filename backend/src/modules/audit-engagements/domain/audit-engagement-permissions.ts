import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'audit-engagement:view': true;
    'audit-engagement:create': true;
    'audit-engagement:edit': true;
    'audit-engagement:scope': true;
    'audit-engagement:transition': true;
  }
}

export const AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'audit-engagement:view',
    resource: 'audit-engagement',
    action: 'VIEW',
    description:
      'Ver engajamentos de auditoria e seu escopo dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'audit-engagement:create',
    resource: 'audit-engagement',
    action: 'CREATE',
    description: 'Abrir um novo engajamento de auditoria.',
  },
  {
    identifier: 'audit-engagement:edit',
    resource: 'audit-engagement',
    action: 'EDIT',
    description:
      'Editar os campos descritivos de um engajamento de auditoria (objetivo, período, ' +
      'auditor líder, unidade organizacional) enquanto estiver em PLANNING.',
  },
  {
    identifier: 'audit-engagement:scope',
    resource: 'audit-engagement',
    action: 'LINK',
    description:
      'Adicionar uma versão de framework, requisito ou controle ao escopo de um engajamento ' +
      'enquanto estiver em PLANNING.',
  },
  {
    identifier: 'audit-engagement:transition',
    resource: 'audit-engagement',
    action: 'TRANSITION',
    description: 'Iniciar, concluir ou cancelar um engajamento de auditoria.',
  },
];
