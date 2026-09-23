import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'asset:view': true;
    'asset:create': true;
    'asset:edit': true;
    'asset:administer': true;
  }
}

export const ASSET_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'asset:view',
    resource: 'asset',
    action: 'VIEW',
    description: 'Listar e ler ativos dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'asset:create',
    resource: 'asset',
    action: 'CREATE',
    description: 'Cadastrar um novo ativo.',
  },
  {
    identifier: 'asset:edit',
    resource: 'asset',
    action: 'EDIT',
    description: 'Editar o nome, a descrição e a unidade organizacional de um ativo.',
  },
  {
    identifier: 'asset:administer',
    resource: 'asset',
    action: 'ADMINISTER',
    description: 'Desativar ou reativar um ativo.',
  },
];
