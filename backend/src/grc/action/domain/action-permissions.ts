import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'action:view': true;
    'action:create': true;
    'action:edit': true;
  }
}

export const ACTION_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'action:view',
    resource: 'action',
    action: 'VIEW',
    description: 'Ver planos de ação dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'action:create',
    resource: 'action',
    action: 'CREATE',
    description: 'Criar um plano de ação a partir de uma origem GRC.',
  },
  {
    identifier: 'action:edit',
    resource: 'action',
    action: 'EDIT',
    description:
      'Editar o título, a descrição, o responsável ou o prazo de um plano de ação, e movê-lo pelo seu ciclo de vida.',
  },
];
