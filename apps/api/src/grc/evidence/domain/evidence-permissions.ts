import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'evidence:view': true;
    'evidence:create': true;
    'evidence:edit': true;
    'evidence:administer': true;
    'evidence:link': true;
  }
}

export const EVIDENCE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'evidence:view',
    resource: 'evidence',
    action: 'VIEW',
    description: 'Ver registros de evidência dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'evidence:create',
    resource: 'evidence',
    action: 'CREATE',
    description: 'Registrar uma nova evidência.',
  },
  {
    identifier: 'evidence:edit',
    resource: 'evidence',
    action: 'EDIT',
    description: 'Editar os metadados descritivos de um registro de evidência.',
  },
  {
    identifier: 'evidence:administer',
    resource: 'evidence',
    action: 'ADMINISTER',
    description: 'Arquivar um registro de evidência.',
  },
  {
    identifier: 'evidence:link',
    resource: 'evidence',
    action: 'LINK',
    description: 'Vincular ou desvincular um registro de evidência a um sujeito GRC.',
  },
];
