/**
 * T009/004-compliance-management — Compliance's own permission definitions
 * (data-model.md §11, FR-023, research.md D-13). Follows
 * `modules/controls/control-permissions.ts` exactly — see that file's
 * header for the full explanation of the two extension points (compile-time
 * `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * Sits directly under `src/modules/compliance/` — not under `domain/**` —
 * matching `control-permissions.ts`'s own precedent: files at a module's
 * root, outside `domain/application/infrastructure/presentation`, are not
 * classified by `eslint-plugin-boundaries`
 * (`apps/api/eslint.config.mjs`'s `boundaries/elements` patterns only match
 * `src/modules/(*)/{domain,application,infrastructure,presentation}/**`),
 * so no boundary policy restricts what this file may import.
 *
 * ## Three permissions, no segregation-of-duties pair (research.md D-13)
 *
 * `compliance:view` — read the normative library, links, applicability and
 * compliance state. `compliance:administer` — the normative library's own
 * write path: register/edit a framework, create/edit/publish a version,
 * create/edit a requirement, declare/revert applicability (US1 AS1 names
 * this permission literally). `compliance:map` — link/unlink a requirement
 * to a control and execute a mapping migration (User Story 2, out of this
 * workstream's own scope; declared here because the catalogue is Fase 1's
 * responsibility in full).
 *
 * Unlike `control:test`/`control:approve` (Fase 2, a real segregation
 * invariant the spec names explicitly), no FR or acceptance scenario of
 * this feature asks that "quem declara não aplicável" or "quem mapeia" be
 * a different person from "quem publica a versão" — inventing that
 * separation here would be functionality CLAUDE.md §2 does not authorize.
 */
import type { PermissionDefinition } from '../../core/authorization/domain/permissions';

declare module '../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'compliance:view': true;
    'compliance:administer': true;
    'compliance:map': true;
  }
}

/**
 * Compliance's seeded permission set (data-model.md §11). Combined with
 * every other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
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
