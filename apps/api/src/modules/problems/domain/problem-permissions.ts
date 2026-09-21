/**
 * 008-incidents-problems, foundation — `Problem`'s own permission
 * definitions (spec.md FR-021, research.md D-2). Identical in shape to
 * `modules/incidents/domain/incident-permissions.ts` — see that file's
 * header for the reasoning this one deliberately does not repeat.
 *
 * `problem:link` gates all five Problem relationship pairs (spec.md
 * FR-013/FR-015a): Risk, and — by decision of the coordinator
 * (research.md D-14) — the write side of Problem↔Incident
 * (`POST`/`DELETE /problems/{problemId}/incidents`). Creating that link
 * ALSO requires `incident:view` on the target (ADR-020 part 5, spec.md
 * FR-015b) — checked in the use case that consumes both permissions, not
 * here; this file only declares `problem:link` itself.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'problem:view': true;
    'problem:create': true;
    'problem:edit': true;
    'problem:transition': true;
    'problem:link': true;
  }
}

/**
 * Problem's seeded permission set (spec.md FR-021). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
export const PROBLEM_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'problem:view',
    resource: 'problem',
    action: 'VIEW',
    description: 'Listar e ler problemas dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'problem:create',
    resource: 'problem',
    action: 'CREATE',
    description: 'Registrar um novo problema.',
  },
  {
    identifier: 'problem:edit',
    resource: 'problem',
    action: 'EDIT',
    description: 'Editar o título, a descrição, a severidade e o responsável de um problema.',
  },
  {
    identifier: 'problem:transition',
    resource: 'problem',
    action: 'TRANSITION',
    description:
      'Mover um problema pelo seu ciclo de vida, incluindo o encerramento sujeito a segregação de funções.',
  },
  {
    identifier: 'problem:link',
    resource: 'problem',
    action: 'LINK',
    description:
      'Vincular ou desvincular um problema a um risco, ou a um incidente que ele explica.',
  },
];
