import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'indicator:view': true;
    'indicator:create': true;
    'indicator:edit': true;
  }
}

export const INDICATOR_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'indicator:view',
    resource: 'indicator',
    action: 'VIEW',
    description:
      'Listar definições de indicador e ler o valor atual ou histórico de um indicador, sujeito ' +
      'à própria permissão de leitura da métrica de origem.',
  },
  {
    identifier: 'indicator:create',
    resource: 'indicator',
    action: 'CREATE',
    description: 'Criar uma definição de indicador para uma métrica.',
  },
  {
    identifier: 'indicator:edit',
    resource: 'indicator',
    action: 'EDIT',
    description:
      'Editar o nome, o limiar e o responsável de uma definição de indicador, e registrar uma ' +
      'nova medição histórica.',
  },
];
