/**
 * T008/002-shared-grc-foundation — Evidence's own permission definitions
 * (ADR-016, FR-033, data-model.md, contracts/grc-foundation.openapi.yaml).
 * Follows `modules/risk/domain/risk-permissions.ts` exactly — see that
 * file's header for the full explanation of the two extension points this
 * file exercises (compile-time `declare module` augmentation of
 * `PermissionRegistry`, and static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * `grc/**` may depend on `core/**` (ADR-016), so this import is allowed —
 * the same relationship `modules/risk` already has with `core`.
 *
 * ## Identifiers, derived from the contract, not invented
 *
 * Every identifier below is named verbatim by an operation's own
 * description in `contracts/grc-foundation.openapi.yaml`:
 * `listEvidence`/`getEvidence` -> `evidence:view`; `createEvidence` ->
 * `evidence:create`; `updateEvidence` -> `evidence:edit`; `archiveEvidence`
 * -> `evidence:administer`; `linkEvidence`/`unlinkEvidence` ->
 * `evidence:link`. No permission is declared that no operation names, and
 * none an operation names is omitted.
 *
 * There is deliberately no `evidence:delete`: FR-009 forbids ever hard
 * deleting evidence (removal is archival, gated by `evidence:administer`),
 * the same reasoning `risk-permissions.ts`'s header gives for the absence
 * of `risk:delete`.
 *
 * ## `LINK` — a new `PermissionAction` value, not a repurposed one
 *
 * `evidence:link` names both `linkEvidence` and its inverse
 * `unlinkEvidence` — linking and unlinking answer to the same authority
 * (contracts/grc-foundation.openapi.yaml's own `unlinkEvidence`
 * description: "Requires `evidence:link`"). `PermissionAction` grew a
 * `LINK` member for this (`20260907085000_permission_action_add_grc_
 * foundation`) rather than reusing `EDIT` — linking is not an edit of the
 * evidence's own fields, and R-010/FR-031 treat it as authorized
 * independently on both sides (the evidence AND the subject), which is a
 * distinct enough operation to deserve its own action label in the
 * permissions administration screen, the same way `risk:treat`/
 * `risk:transition` got their own labels instead of folding into `EDIT`.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'evidence:view': true;
    'evidence:create': true;
    'evidence:edit': true;
    'evidence:administer': true;
    'evidence:link': true;
  }
}

/** Evidence's seeded permission set. Combined with every other capability's
 * by `src/permission-catalogue.ts`'s `getAllPermissionDefinitions` — never
 * imported directly by application code. Deliberately NOT granted to any
 * seeded role here or anywhere in this task: which roles receive these is
 * a decision that belongs with the domain implementation (US1). */
export const EVIDENCE_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'evidence:view',
    resource: 'evidence',
    action: 'VIEW',
    description: 'Ver registros de evidência dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'evidence:create',
    resource: 'evidence',
    action: 'CREATE',
    description: 'Registrar uma nova evidência.',
  },
  {
    identifier: 'evidence:edit',
    resource: 'evidence',
    action: 'EDIT',
    description: 'Editar os metadados descritivos de um registro de evidência.',
  },
  {
    identifier: 'evidence:administer',
    resource: 'evidence',
    action: 'ADMINISTER',
    description: 'Arquivar um registro de evidência.',
  },
  {
    identifier: 'evidence:link',
    resource: 'evidence',
    action: 'LINK',
    description: 'Vincular ou desvincular um registro de evidência a um sujeito GRC.',
  },
];
