import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'problem:view': true;
    'problem:create': true;
    'problem:edit': true;
    'problem:transition': true;
    'problem:link': true;
  }
}

export const PROBLEM_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'problem:view',
    resource: 'problem',
    action: 'VIEW',
    description: 'Listar e ler problemas dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'problem:create',
    resource: 'problem',
    action: 'CREATE',
    description: 'Registrar um novo problema.',
  },
  {
    identifier: 'problem:edit',
    resource: 'problem',
    action: 'EDIT',
    description: 'Editar o título, a descrição, a severidade e o responsável de um problema.',
  },
  {
    identifier: 'problem:transition',
    resource: 'problem',
    action: 'TRANSITION',
    description:
      'Mover um problema pelo seu ciclo de vida, incluindo o encerramento sujeito a segregação de funções.',
  },
  {
    identifier: 'problem:link',
    resource: 'problem',
    action: 'LINK',
    description:
      'Vincular ou desvincular um problema a um risco, ou a um incidente que ele explica.',
  },
];
