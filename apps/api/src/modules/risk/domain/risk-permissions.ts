/**
 * A3 remediation — Risk Management's own permission definitions (ADR-003,
 * FR-021/FR-022, data-model.md §3), moved out of
 * `core/authorization/domain/permissions.ts`'s `CORE_PERMISSION_DEFINITIONS`
 * so `core/**` no longer declares business-module permissions (ADR-011:
 * "`core/**` must not import from `modules/**`" — declaring `risk:*` inside
 * core was the same coupling in the other direction, core *knowing about*
 * a business module by name).
 *
 * This file is the worked example `core/authorization/domain/permissions.ts`'s
 * own header now points to. It exercises both extension points that file
 * documents:
 *
 * 1. **Compile-time** — the `declare module` augmentation below merges these
 *    eight identifiers into `PermissionRegistry` or, equivalently,
 *    `PermissionIdentifier` (`keyof PermissionRegistry`), so
 *    `@RequirePermission('risk:vew')` (typo) still fails `tsc` exactly as it
 *    did when these keys lived in core's own interface body.
 * 2. **Static aggregation** — `RISK_PERMISSION_DEFINITIONS` is a plain,
 *    static array. `src/permission-catalogue.ts` combines it with core's
 *    own `CORE_PERMISSION_DEFINITIONS` (and any future module's) via
 *    `combinePermissionDefinitions`, computed once at import time. Nothing
 *    here registers anything at runtime — the standalone seed script
 *    (`apps/api/prisma/seed/platform.seed.ts`, which boots a minimal Nest
 *    context that never constructs `RiskModule`) sees this exact set by
 *    importing the same aggregator the running application does.
 *
 * ## The deliberate absence of `risk:delete`
 *
 * data-model.md §3 and ADR-003 both specify this explicitly: FR-102
 * forbids ever hard-deleting a risk (removal is represented as archival,
 * gated by `risk:administer`), so a `risk:delete` permission would govern
 * an operation that does not exist — an administrator reading the role
 * editor would see a capability the platform never actually grants.
 */
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

/**
 * Risk Management's seeded permission set (data-model.md §3, FR-022), in
 * the exact `resource:action` form and order the spec lists them. Combined
 * with core's own set by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions`, which both the Nest application and the
 * standalone seed script (T042) import — never imported directly by
 * either.
 */
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
