/**
 * 009-indicators-reports, foundation — `Indicator`'s own permission
 * definitions (spec.md FR-034, research.md D-13). Follows
 * `modules/incidents/domain/incident-permissions.ts`/
 * `modules/problems/domain/problem-permissions.ts` exactly — see either
 * file's header for the full explanation of the two extension points
 * (compile-time `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * Three permissions, ALL reusing existing `PermissionAction` values — no new
 * value is needed (research.md D-13):
 *
 *   - `indicator:view` — read the definition catalogue and the current/
 *     historical value of an indicator (spec.md FR-006/FR-014). Always
 *     required alongside the source domain's OWN read permission
 *     (`risk:view`, `control:view`, etc.) — checked by the use case that
 *     consumes both, not declared here.
 *   - `indicator:create` — create an `IndicatorDefinition` (spec.md FR-003).
 *   - `indicator:edit` — edit an `IndicatorDefinition`, and create an
 *     `IndicatorMeasurement` (spec.md FR-003/FR-012) — the same "edit also
 *     covers the domain's own lifecycle-shaping writes" shape already used
 *     elsewhere in this platform (e.g. `action:edit` covering both field
 *     edits and transitions).
 *
 * No `indicator:transition`/`indicator:link`/`indicator:administer`:
 * `IndicatorDefinition`/`IndicatorMeasurement` have no lifecycle states
 * beyond append-only history (research.md D-2), no relationship pairs of
 * their own (research.md D-4 — a metric provider reuses another domain's
 * read permission instead of a link), and no hard delete or archival
 * concept in this fase's scope.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'indicator:view': true;
    'indicator:create': true;
    'indicator:edit': true;
  }
}

/**
 * Indicator's seeded permission set (spec.md FR-034). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
export const INDICATOR_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'indicator:view',
    resource: 'indicator',
    action: 'VIEW',
    description:
      'Listar definições de indicador e ler o valor atual ou histórico de um indicador, sujeito ' +
      'à própria permissão de leitura da métrica de origem.',
  },
  {
    identifier: 'indicator:create',
    resource: 'indicator',
    action: 'CREATE',
    description: 'Criar uma definição de indicador para uma métrica.',
  },
  {
    identifier: 'indicator:edit',
    resource: 'indicator',
    action: 'EDIT',
    description:
      'Editar o nome, o limiar e o responsável de uma definição de indicador, e registrar uma ' +
      'nova medição histórica.',
  },
];
