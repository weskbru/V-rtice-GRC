/**
 * T008/005-audit-findings — Audit Engagements' own permission definitions
 * (data-model.md §10, FR-019, research.md D-7). Follows
 * `modules/controls/control-permissions.ts` exactly — see that file's
 * header for the full explanation of the two extension points (compile-time
 * `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * ## Naming collision, found and avoided (FR-019)
 *
 * `audit:view` already exists — a CORE permission
 * (`core/authorization/domain/permissions.ts`), governing read access to
 * the platform's cross-cutting audit TRAIL (`core/audit`), already seeded
 * to the `Auditor` role. Naming this module's permissions `audit:*` would
 * collide semantically with a totally different capability. This module's
 * resource is `audit-engagement`, never `audit` — `test/unit/
 * audit-engagement-permission-namespace.spec.ts` (T010) guards this
 * decision in code, not only in this comment.
 *
 * Sits directly under `src/modules/audit-engagements/domain/` — matching
 * `control-permissions.ts`'s own placement at its module's root rather than
 * inside `domain/**`... actually this file DOES live under `domain/` here,
 * unlike `control-permissions.ts` (which sits at `modules/controls/`'s own
 * root) — both placements are equally unrestricted by
 * `eslint-plugin-boundaries`, whose `module-domain` element type matches
 * `src/modules/(*)/domain/**` and only restricts what `module-domain` may
 * import (its own module's `module-domain`, plus `shared/**`), never what
 * may import INTO it — this file imports nothing beyond
 * `PermissionDefinition`, itself living in `core-domain`, a legal target.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'audit-engagement:view': true;
    'audit-engagement:create': true;
    'audit-engagement:edit': true;
    'audit-engagement:scope': true;
    'audit-engagement:transition': true;
  }
}

/**
 * Audit Engagements' seeded permission set (data-model.md §10). Combined
 * with every other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 *
 * `action` reuses `PermissionAction.LINK` for `audit-engagement:scope`
 * (the three scope-link write operations) and `TRANSITION` for
 * `audit-engagement:transition` (start/complete/cancel) — both already
 * exist (`evidence:link`, `risk:transition`), so no new `PermissionAction`
 * enum value is introduced (research.md D-7).
 */
export const AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'audit-engagement:view',
    resource: 'audit-engagement',
    action: 'VIEW',
    description:
      'Ver engajamentos de auditoria e seu escopo dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'audit-engagement:create',
    resource: 'audit-engagement',
    action: 'CREATE',
    description: 'Abrir um novo engajamento de auditoria.',
  },
  {
    identifier: 'audit-engagement:edit',
    resource: 'audit-engagement',
    action: 'EDIT',
    description:
      'Editar os campos descritivos de um engajamento de auditoria (objetivo, período, ' +
      'auditor líder, unidade organizacional) enquanto estiver em PLANNING.',
  },
  {
    identifier: 'audit-engagement:scope',
    resource: 'audit-engagement',
    action: 'LINK',
    description:
      'Adicionar uma versão de framework, requisito ou controle ao escopo de um engajamento ' +
      'enquanto estiver em PLANNING.',
  },
  {
    identifier: 'audit-engagement:transition',
    resource: 'audit-engagement',
    action: 'TRANSITION',
    description: 'Iniciar, concluir ou cancelar um engajamento de auditoria.',
  },
];
