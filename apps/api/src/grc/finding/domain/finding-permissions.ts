/**
 * T008/002-shared-grc-foundation — Finding's own permission definitions
 * (ADR-016, FR-033, data-model.md, contracts/grc-foundation.openapi.yaml).
 * Follows `modules/risk/domain/risk-permissions.ts` exactly — see that
 * file's header for the full explanation of the two extension points
 * (compile-time `PermissionRegistry` augmentation, static aggregation via
 * `combinePermissionDefinitions` in `src/permission-catalogue.ts`).
 *
 * ## Identifiers, derived from the contract, not invented
 *
 * `listFindings`/`getFinding` -> `finding:view`; `createFinding` ->
 * `finding:create`; `updateFinding` -> `finding:edit`; `closeFinding`/
 * `reopenFinding` -> `finding:close` (contracts/grc-foundation.openapi.yaml's
 * own `reopenFinding` description: "Requires `finding:close` - reopening
 * reverses a closure, so it answers to the same authority");
 * `archiveFinding` -> `finding:administer`. No `finding:delete`: FR-027
 * forbids ever hard deleting a finding (removal is archival, gated by
 * `finding:administer`), the same reasoning already given for the absence
 * of `risk:delete`/`evidence:delete`.
 *
 * ## `CLOSE` — a new `PermissionAction` value, not a repurposed one
 *
 * Closing (and reopening) a finding is segregation-of-duties gated
 * (FR-025: the closer must differ from whoever completed the remediating
 * work) — a materially different authority than an ordinary field edit, so
 * it is its own action label (`20260907085000_permission_action_add_grc_
 * foundation`) rather than folded into `EDIT`, the same reasoning
 * `evidence-permissions.ts` gives for `LINK`.
 *
 * ## T009/005-audit-findings — two additive permissions, no new
 * `PermissionAction` value
 *
 * `finding:remediate` (`TRANSITION`, reused — the same action label
 * `risk:transition` already established for a domain-specific state move
 * that is not an ordinary `EDIT`) gates `startFindingRemediation` — the
 * operation that finally makes `OPEN -> IN_REMEDIATION` reachable
 * (research.md D-10, D-7). `finding:link` (`LINK`, reused — the same
 * action label `evidence:link` already established) gates
 * `linkFindingToControl`/`unlinkFindingFromControl`/
 * `linkFindingToRisk`/`unlinkFindingFromRisk`; listing the links stays
 * under `finding:view`, already declared above (research.md D-7). Neither
 * introduces a `PermissionAction` migration — both verbs already exist in
 * the enum for exactly this reason.
 */
import type { PermissionDefinition } from '../../../core/authorization/domain/permissions';

declare module '../../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'finding:view': true;
    'finding:create': true;
    'finding:edit': true;
    'finding:close': true;
    'finding:administer': true;
    'finding:remediate': true;
    'finding:link': true;
  }
}

/** Finding's seeded permission set. Combined with every other capability's
 * by `src/permission-catalogue.ts`'s `getAllPermissionDefinitions` — never
 * imported directly by application code. Deliberately NOT granted to any
 * seeded role here or anywhere in this task: which roles receive these is
 * a decision that belongs with the domain implementation (US3). */
export const FINDING_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'finding:view',
    resource: 'finding',
    action: 'VIEW',
    description: 'Ver achados dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'finding:create',
    resource: 'finding',
    action: 'CREATE',
    description: 'Registrar um achado.',
  },
  {
    identifier: 'finding:edit',
    resource: 'finding',
    action: 'EDIT',
    description: 'Editar os campos descritivos, a severidade ou a prioridade de um achado.',
  },
  {
    identifier: 'finding:close',
    resource: 'finding',
    action: 'CLOSE',
    description: 'Encerrar um achado, ou reabrir um que já tenha sido encerrado.',
  },
  {
    identifier: 'finding:administer',
    resource: 'finding',
    action: 'ADMINISTER',
    description: 'Arquivar um achado encerrado.',
  },
  {
    identifier: 'finding:remediate',
    resource: 'finding',
    action: 'TRANSITION',
    description: 'Mover um achado de OPEN para IN_REMEDIATION.',
  },
  {
    identifier: 'finding:link',
    resource: 'finding',
    action: 'LINK',
    description:
      'Vincular ou desvincular um achado a um controle que ele implica ou um risco que ele materializa.',
  },
];
