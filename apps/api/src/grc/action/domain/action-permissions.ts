/**
 * T008/002-shared-grc-foundation — Action's own permission definitions
 * (ADR-016, FR-033, data-model.md, contracts/grc-foundation.openapi.yaml).
 * Follows `modules/risk/domain/risk-permissions.ts` exactly — see that
 * file's header for the full explanation of the two extension points
 * (compile-time `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * ## Identifiers, derived from the contract, not invented
 *
 * `listActions`/`getAction` -> `action:view`; `createAction` ->
 * `action:create`; `updateAction`/`transitionAction` -> `action:edit`
 * (contracts/grc-foundation.openapi.yaml's own `transitionAction`
 * description: "Requires `action:edit`" — a lifecycle transition is not a
 * distinct permission from an ordinary field edit). No `action:delete`:
 * FR-011-FR-019 give `Action` no delete operation at all — cancellation
 * and completion are `status` transitions, not removal.
 *
 * `createAction`'s own description additionally requires "edit permission
 * and scope on the origin record" (FR-031: authorization on ALL entities
 * involved, not only the principal) — that second check is against the
 * ORIGIN's own permission (e.g. `risk:treat`, checked by the origin
 * resolver adapter, T049/US2, out of this task's scope), not a second
 * `action:*` identifier, so it is not declared here.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'action:view': true;
    'action:create': true;
    'action:edit': true;
  }
}

/** Action's seeded permission set. Combined with every other capability's
 * by `src/permission-catalogue.ts`'s `getAllPermissionDefinitions` — never
 * imported directly by application code. Deliberately NOT granted to any
 * seeded role here or anywhere in this task: which roles receive these is
 * a decision that belongs with the domain implementation (US2). */
export const ACTION_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'action:view',
    resource: 'action',
    action: 'VIEW',
    description: 'Ver planos de ação dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'action:create',
    resource: 'action',
    action: 'CREATE',
    description: 'Criar um plano de ação a partir de uma origem GRC.',
  },
  {
    identifier: 'action:edit',
    resource: 'action',
    action: 'EDIT',
    description:
      'Editar o título, a descrição, o responsável ou o prazo de um plano de ação, e movê-lo pelo seu ciclo de vida.',
  },
];
