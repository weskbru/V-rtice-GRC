import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'finding:view': true;
    'finding:create': true;
    'finding:edit': true;
    'finding:close': true;
    'finding:administer': true;
    'finding:remediate': true;
    'finding:link': true;
  }
}

export const FINDING_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'finding:view',
    resource: 'finding',
    action: 'VIEW',
    description: 'Ver achados dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'finding:create',
    resource: 'finding',
    action: 'CREATE',
    description: 'Registrar um achado.',
  },
  {
    identifier: 'finding:edit',
    resource: 'finding',
    action: 'EDIT',
    description: 'Editar os campos descritivos, a severidade ou a prioridade de um achado.',
  },
  {
    identifier: 'finding:close',
    resource: 'finding',
    action: 'CLOSE',
    description: 'Encerrar um achado, ou reabrir um que já tenha sido encerrado.',
  },
  {
    identifier: 'finding:administer',
    resource: 'finding',
    action: 'ADMINISTER',
    description: 'Arquivar um achado encerrado.',
  },
  {
    identifier: 'finding:remediate',
    resource: 'finding',
    action: 'TRANSITION',
    description: 'Mover um achado de OPEN para IN_REMEDIATION.',
  },
  {
    identifier: 'finding:link',
    resource: 'finding',
    action: 'LINK',
    description:
      'Vincular ou desvincular um achado a um controle que ele implica ou um risco que ele materializa.',
  },
];
