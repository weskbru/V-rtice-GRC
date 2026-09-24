import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'risk:view': true;
    'risk:create': true;
    'risk:edit': true;
    'risk:assess': true;
    'risk:treat': true;
    'risk:transition': true;
    'risk:approve': true;
    'risk:administer': true;
  }
}

export const RISK_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'risk:view',
    resource: 'risk',
    action: 'VIEW',
    description: 'Ver registros de risco dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'risk:create',
    resource: 'risk',
    action: 'CREATE',
    description: 'Criar novos registros de risco.',
  },
  {
    identifier: 'risk:edit',
    resource: 'risk',
    action: 'EDIT',
    description: 'Editar os campos descritivos e de classificação de um risco.',
  },
  {
    identifier: 'risk:assess',
    resource: 'risk',
    action: 'ASSESS',
    description: 'Registrar uma avaliação de risco.',
  },
  {
    identifier: 'risk:treat',
    resource: 'risk',
    action: 'TREAT',
    description:
      'Registrar decisões de tratamento, planos de ação de tratamento e vínculos de controle para um risco.',
  },
  {
    identifier: 'risk:transition',
    resource: 'risk',
    action: 'TRANSITION',
    description:
      'Solicitar uma transição de ciclo de vida de risco, inclusive uma sujeita a aprovação.',
  },
  {
    identifier: 'risk:approve',
    resource: 'risk',
    action: 'APPROVE',
    description:
      'Decidir (aprovar ou rejeitar) uma aprovação pendente de ciclo de vida de risco solicitada por outro usuário.',
  },
  {
    identifier: 'risk:administer',
    resource: 'risk',
    action: 'ADMINISTER',
    description: 'Administrar registros de risco, incluindo arquivar um risco encerrado.',
  },
];
