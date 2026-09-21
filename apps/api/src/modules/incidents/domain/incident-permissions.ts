/**
 * 008-incidents-problems, foundation — `Incident`'s own permission
 * definitions (spec.md FR-021, research.md D-2). Follows
 * `modules/assets/domain/asset-permissions.ts`/
 * `modules/processes/domain/process-permissions.ts` exactly — see either
 * file's header for the full explanation of the two extension points
 * (compile-time `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * Five permissions, ALL reusing existing `PermissionAction` values — no new
 * value is needed:
 *
 *   - `incident:view` / `incident:create` / `incident:edit` — the ordinary
 *     CRUD verbs, same as every other business module.
 *   - `incident:transition` — reuses the `TRANSITION` action `risk:transition`/
 *     `finding:remediate` already established for a domain-specific state
 *     move that plain `EDIT` does not name (spec.md FR-002/FR-021):
 *     `PATCH /incidents/{id}` never accepts `status`; only
 *     `POST /incidents/{id}/transitions` does, and it is gated separately.
 *   - `incident:link` — reuses the `LINK` action `evidence:link`/
 *     `finding:link` already established, gating the four Incident
 *     relationship pairs (spec.md FR-013): Risk, Asset, Process, and the
 *     read side of Problem (the write side answers to `problem:link`,
 *     research.md D-14).
 *
 * No `incident:administer`/`incident:delete`: FR-006 requires no
 * segregation-of-duties gate on closing an incident, and there is no hard
 * delete (a mistaken incident is cancelled, not removed) — the same
 * reasoning already given for the absence of `risk:delete`/
 * `evidence:delete`/`finding:delete`.
 */
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

/**
 * Incident's seeded permission set (spec.md FR-021). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
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
