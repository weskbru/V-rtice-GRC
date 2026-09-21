/**
 * 009-indicators-reports, foundation — `Report`'s own permission
 * definitions (spec.md FR-034, research.md D-13). Identical in shape to
 * `modules/indicators/domain/indicator-permissions.ts` — see that file's
 * header for the reasoning this one deliberately does not repeat.
 *
 * Three permissions, ALL reusing existing `PermissionAction` values — no new
 * value is needed (research.md D-13):
 *
 *   - `report:view` — read the report definition catalogue and run a report
 *     (spec.md FR-025). Running a report never fails wholesale for a
 *     `metricKey` the caller lacks source permission for — that item is
 *     marked `available: false` instead (spec.md FR-026); `report:view`
 *     itself gates the operation as a whole.
 *   - `report:create` — create a `ReportDefinition` (spec.md FR-023).
 *   - `report:edit` — edit a `ReportDefinition` (spec.md FR-023).
 *
 * No `report:transition`/`report:link`/`report:administer`: a
 * `ReportDefinition` has no lifecycle states, no relationship pairs of its
 * own (it only references `IndicatorMetricKey` values, never another GRC
 * entity — research.md D-1), and no hard delete or archival concept in this
 * fase's scope.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'report:view': true;
    'report:create': true;
    'report:edit': true;
  }
}

/**
 * Report's seeded permission set (spec.md FR-034). Combined with every
 * other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
export const REPORT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'report:view',
    resource: 'report',
    action: 'VIEW',
    description:
      'Listar definições de relatório e executar um relatório, calculando toda métrica de ' +
      'indicador referenciada.',
  },
  {
    identifier: 'report:create',
    resource: 'report',
    action: 'CREATE',
    description:
      'Criar uma definição de relatório referenciando uma ou mais métricas de indicador.',
  },
  {
    identifier: 'report:edit',
    resource: 'report',
    action: 'EDIT',
    description: 'Editar o nome e a lista de métricas de uma definição de relatório.',
  },
];
