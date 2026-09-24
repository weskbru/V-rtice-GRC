import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'process:view': true;
    'process:create': true;
    'process:edit': true;
    'process:administer': true;
  }
}

export const PROCESS_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'process:view',
    resource: 'process',
    action: 'VIEW',
    description: 'Listar e ler processos dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'process:create',
    resource: 'process',
    action: 'CREATE',
    description: 'Cadastrar um novo processo.',
  },
  {
    identifier: 'process:edit',
    resource: 'process',
    action: 'EDIT',
    description: 'Editar o nome, a descrição e a unidade organizacional de um processo.',
  },
  {
    identifier: 'process:administer',
    resource: 'process',
    action: 'ADMINISTER',
    description: 'Desativar ou reativar um processo.',
  },
];
