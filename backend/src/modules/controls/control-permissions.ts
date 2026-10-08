import type { PermissionDefinition } from '../../core/authorization/domain/permissions';

declare module '../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'control:view': true;
    'control:create': true;
    'control:edit': true;
    'control:test': true;
    'control:approve': true;
    'control:administer': true;
  }
}

export const CONTROL_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'control:view',
    resource: 'control',
    action: 'VIEW',
    description: 'Ver registros de controle dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'control:create',
    resource: 'control',
    action: 'CREATE',
    description: 'Criar novos registros de controle.',
  },
  {
    identifier: 'control:edit',
    resource: 'control',
    action: 'EDIT',
    description:
      'Editar os campos descritivos, de responsabilidade e de classificação de um controle, e ' +
      'movê-lo pelas transições DRAFT->ACTIVE e ACTIVE<->SUSPENDED.',
  },
  {
    identifier: 'control:test',
    resource: 'control',
    action: 'ASSESS',
    description:
      'Registrar uma avaliação de efetividade de um controle, e submeter uma avaliação ' +
      'registrada para atestação.',
  },
  {
    identifier: 'control:approve',
    resource: 'control',
    action: 'APPROVE',
    description:
      'Decidir (atestar ou rejeitar) uma atestação pendente de avaliação de controle solicitada ' +
      'por outro usuário.',
  },
  {
    identifier: 'control:administer',
    resource: 'control',
    action: 'ADMINISTER',
    description: 'Descontinuar um controle (a transição terminal ->RETIRED do ciclo de vida).',
  },
];
