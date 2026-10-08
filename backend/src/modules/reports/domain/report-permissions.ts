import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'report:view': true;
    'report:create': true;
    'report:edit': true;
  }
}

export const REPORT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'report:view',
    resource: 'report',
    action: 'VIEW',
    description:
      'Listar definições de relatório e executar um relatório, calculando toda métrica de ' +
      'indicador referenciada.',
  },
  {
    identifier: 'report:create',
    resource: 'report',
    action: 'CREATE',
    description:
      'Criar uma definição de relatório referenciando uma ou mais métricas de indicador.',
  },
  {
    identifier: 'report:edit',
    resource: 'report',
    action: 'EDIT',
    description: 'Editar o nome e a lista de métricas de uma definição de relatório.',
  },
];
