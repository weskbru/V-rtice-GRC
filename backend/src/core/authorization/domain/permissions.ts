import type { PermissionAction } from '@prisma/client';

export interface PermissionDefinition {
  readonly identifier: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly description: string;
}

export interface PermissionRegistry {
  'audit:view': true;
  'user:administer': true;
  'role:administer': true;
  'org_unit:administer': true;
  'methodology:administer': true;
  'attachment:create': true;
  'attachment:delete': true;
  'comment:create': true;
  'comment:delete': true;
}

export type PermissionIdentifier = keyof PermissionRegistry;

export const CORE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'audit:view',
    resource: 'audit',
    action: 'VIEW',
    description: 'Ver a trilha de auditoria de um registro.',
  },
  {
    identifier: 'user:administer',
    resource: 'user',
    action: 'ADMINISTER',
    description: 'Criar, modificar, desativar e atribuir papéis a usuários.',
  },
  {
    identifier: 'role:administer',
    resource: 'role',
    action: 'ADMINISTER',
    description: 'Criar e modificar papéis e suas permissões.',
  },
  {
    identifier: 'org_unit:administer',
    resource: 'org_unit',
    action: 'ADMINISTER',
    description: 'Criar, modificar e reorganizar a estrutura de unidades organizacionais.',
  },
  {
    identifier: 'methodology:administer',
    resource: 'methodology',
    action: 'ADMINISTER',
    description: 'Configurar a metodologia de risco (escalas, matriz, faixas de nível).',
  },
  {
    identifier: 'attachment:create',
    resource: 'attachment',
    action: 'CREATE',
    description: 'Enviar um anexo para um registro.',
  },
  {
    identifier: 'attachment:delete',
    resource: 'attachment',
    action: 'DELETE',
    description: 'Retirar um anexo de um registro.',
  },
  {
    identifier: 'comment:create',
    resource: 'comment',
    action: 'CREATE',
    description: 'Adicionar um comentário a um registro.',
  },
  {
    identifier: 'comment:delete',
    resource: 'comment',
    action: 'DELETE',
    description: 'Retirar um comentário de um registro.',
  },
];

export function combinePermissionDefinitions(
  ...definitionSets: readonly (readonly PermissionDefinition[])[]
): readonly PermissionDefinition[] {
  const byIdentifier = new Map<string, PermissionDefinition>();

  for (const definitions of definitionSets) {
    for (const definition of definitions) {
      if (byIdentifier.has(definition.identifier)) {
        throw new Error(
          `Permission identifier "${definition.identifier}" is already registered. ` +
            'Permission identifiers must be globally unique across every module.',
        );
      }
      byIdentifier.set(definition.identifier, definition);
    }
  }

  return Array.from(byIdentifier.values());
}
