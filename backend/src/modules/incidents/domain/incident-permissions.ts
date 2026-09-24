import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'incident:view': true;
    'incident:create': true;
    'incident:edit': true;
    'incident:transition': true;
    'incident:link': true;
  }
}

export const INCIDENT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'incident:view',
    resource: 'incident',
    action: 'VIEW',
    description: 'Listar e ler incidentes dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'incident:create',
    resource: 'incident',
    action: 'CREATE',
    description: 'Registrar um novo incidente.',
  },
  {
    identifier: 'incident:edit',
    resource: 'incident',
    action: 'EDIT',
    description: 'Editar o título, a descrição, a severidade e o responsável de um incidente.',
  },
  {
    identifier: 'incident:transition',
    resource: 'incident',
    action: 'TRANSITION',
    description: 'Mover um incidente pelo seu ciclo de vida.',
  },
  {
    identifier: 'incident:link',
    resource: 'incident',
    action: 'LINK',
    description: 'Vincular ou desvincular um incidente a um risco, ativo ou processo.',
  },
];
