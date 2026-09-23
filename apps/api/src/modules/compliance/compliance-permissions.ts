import type { PermissionDefinition } from '../../core/authorization/domain/permissions';

declare module '../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'compliance:view': true;
    'compliance:administer': true;
    'compliance:map': true;
  }
}

export const COMPLIANCE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'compliance:view',
    resource: 'compliance',
    action: 'VIEW',
    description:
      'Ver a biblioteca normativa (frameworks, versões, requisitos), os vínculos requisito-' +
      'controle, as declarações de aplicabilidade e o estado de conformidade.',
  },
  {
    identifier: 'compliance:administer',
    resource: 'compliance',
    action: 'ADMINISTER',
    description:
      'Cadastrar e editar frameworks; criar, editar e publicar versões de framework; criar e ' +
      'editar requisitos; declarar e reverter a aplicabilidade de um requisito.',
  },
  {
    identifier: 'compliance:map',
    resource: 'compliance',
    action: 'LINK',
    description:
      'Vincular e desvincular um requisito a um controle, e executar uma migração de mapeamento ' +
      'entre duas versões do mesmo framework.',
  },
];
