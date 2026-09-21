/**
 * T004/006-assets-processes — Processes' own permission definitions
 * (data-model.md §5, FR-009, FR-020, research.md D-7). Identical in shape to
 * `modules/assets/domain/asset-permissions.ts` — see that file's header for
 * the full reasoning this one deliberately does not repeat (FR-020:
 * symmetry between Asset and Process is a requirement, not a style choice).
 *
 * Four permissions, reusing existing `PermissionAction` values, no
 * `process:delete` (FR-012) — the same reasoning as `asset-permissions.ts`,
 * applied to `Process` instead of `Asset`.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'process:view': true;
    'process:create': true;
    'process:edit': true;
    'process:administer': true;
  }
}

/**
 * Processes' seeded permission set (data-model.md §5). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
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
