/**
 * T006/003-controls-management — Controls' own permission definitions
 * (data-model.md §8, FR-029). Follows `modules/risk/domain/risk-permissions.ts`
 * exactly — see that file's header for the full explanation of the two
 * extension points (compile-time `PermissionRegistry` augmentation, static
 * aggregation via `combinePermissionDefinitions` in
 * `src/permission-catalogue.ts`).
 *
 * Sits directly under `src/modules/controls/` — not under `domain/**` —
 * matching this task's own instruction and the accepted precedent of
 * `risk.module.ts`/`action.module.ts`/`permission-catalogue.ts` itself:
 * files at a module's root, outside `domain/application/infrastructure/
 * presentation`, are not classified by `eslint-plugin-boundaries`
 * (`apps/api/eslint.config.mjs`'s `boundaries/elements` patterns only match
 * `src/modules/(*)/{domain,application,infrastructure,presentation}/**`),
 * so no boundary policy restricts what this file may import.
 *
 * ## Identifiers, derived from the contract, not invented
 *
 * `listControlCatalog`/`getControl`/`getControlLifecycle`/
 * `listControlAssessments`/`getControlAssessment`/the three link-listing
 * operations -> `control:view`. `createControl` -> `control:create`.
 * `updateControl` and the two non-terminal lifecycle transitions
 * (`DRAFT->ACTIVE`, `ACTIVE<->SUSPENDED`) -> `control:edit`.
 * `createControlAssessment` and `requestControlAssessmentAttestation`
 * (research.md D-9: "quem pode registrar uma verificação pode submetê-la à
 * atestação") -> `control:test`. `decideControlAssessmentAttestation` ->
 * `control:approve`. The terminal `->RETIRED` transition (a discontinuation
 * decision, not a routine edit — contracts/controls.openapi.yaml's
 * `transitionControl`) -> `control:administer`. Process/asset link creation
 * and withdrawal (FR-024, ADR-020 part 5: permission of the side that
 * registers the link) -> `control:edit`, the same permission that gates
 * every other routine edit to a control — not `control:administer`, which
 * governs only the terminal `->RETIRED` transition.
 *
 * No `control:delete`: FR-006 forbids ever hard-deleting a control
 * (discontinuation is the `RETIRED` transition, gated by
 * `control:administer`), so a `control:delete` permission would govern an
 * operation that does not exist — the same reasoning
 * `risk-permissions.ts`'s own header gives for the deliberate absence of
 * `risk:delete`.
 *
 * `action` reuses `PermissionAction.ASSESS` for `control:test` rather than
 * introducing a new enum value: recording a `ControlAssessment` is, in
 * substance, the same category of act as `risk:assess` ("record an
 * assessment") — `PermissionAction` categorizes for display/audit, it is
 * never itself the authorization check (that is always the `identifier`),
 * so reusing the closest existing verb avoids an unjustified schema change
 * (CLAUDE.md §2: "não introduzir dependências sem justificativa" — the
 * same discipline applies to enum growth).
 */
import type { PermissionDefinition } from '../../core/authorization/domain/permissions';

declare module '../../core/authorization/domain/permissions' {
  interface PermissionRegistry {
    'control:view': true;
    'control:create': true;
    'control:edit': true;
    'control:test': true;
    'control:approve': true;
    'control:administer': true;
  }
}

/**
 * Controls Management's seeded permission set (data-model.md §8). Combined
 * with every other capability's by `src/permission-catalogue.ts`'s
 * `getAllPermissionDefinitions` — never imported directly by application
 * code.
 */
export const CONTROL_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = [
  {
    identifier: 'control:view',
    resource: 'control',
    action: 'VIEW',
    description: 'Ver registros de controle dentro do escopo organizacional do usuário.',
  },
  {
    identifier: 'control:create',
    resource: 'control',
    action: 'CREATE',
    description: 'Criar novos registros de controle.',
  },
  {
    identifier: 'control:edit',
    resource: 'control',
    action: 'EDIT',
    description:
      'Editar os campos descritivos, de responsabilidade e de classificação de um controle, e ' +
      'movê-lo pelas transições DRAFT->ACTIVE e ACTIVE<->SUSPENDED.',
  },
  {
    identifier: 'control:test',
    resource: 'control',
    action: 'ASSESS',
    description:
      'Registrar uma avaliação de efetividade de um controle, e submeter uma avaliação ' +
      'registrada para atestação.',
  },
  {
    identifier: 'control:approve',
    resource: 'control',
    action: 'APPROVE',
    description:
      'Decidir (atestar ou rejeitar) uma atestação pendente de avaliação de controle solicitada ' +
      'por outro usuário.',
  },
  {
    identifier: 'control:administer',
    resource: 'control',
    action: 'ADMINISTER',
    description: 'Descontinuar um controle (a transição terminal ->RETIRED do ciclo de vida).',
  },
];
