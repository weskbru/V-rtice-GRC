/**
 * 008-incidents-problems, foundation — Problem. Mirrors
 * `incidents.ts`'s own header — see that file for the reasoning this one
 * deliberately does not repeat.
 *
 * `link` (US3, ADR-020 parts 4/5) additionally covers `Problem -> Incident`
 * (`incidentNotFound`/`incidentAlreadyLinked`/...) — the N:M link's write
 * path is owned here (data-model.md §6), resolving its target through
 * `IncidentDirectoryPort`, never a direct import of `modules/incidents`.
 */
export const problems = {
  /** `NotFoundDomainError`'s `entityType` label — appears verbatim in
   * `problem+json`'s `detail` ("Problema {id} não foi encontrado(a)."). */
  entityLabel: 'Problema',

  // US2 (`createProblem`/`updateProblem`, operations 1-4 of
  // contracts/problems.openapi.yaml) — mirrors `controls.ts`'s own
  // catalog messages exactly (`orgUnitNotFound`/`orgUnitOutOfScope`/
  // `ownerNotFound`/`ownerNotAssignable`), the closest sibling module's
  // convention: two distinct messages, not one non-disclosing message the
  // way `findings.ts` collapses them — neither the contract nor spec.md
  // states a non-disclosure requirement for `orgUnitId` on these two
  // operations (unlike the by-id `GET`/`PATCH`/transition routes, whose
  // 404 already answers "out of scope" and "does not exist" identically).
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  ownerNotFound: 'Usuário informado como dono não encontrado ou inativo.',
  ownerNotAssignable:
    'O usuário informado como dono não pode ser atribuído a esta unidade organizacional.',
  /** Request-shape: `PATCH` body with no fields to change (`minProperties:
   * 1`). */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    /** `problem-lifecycle.ts#findProblemLifecycleTransition` — data-model.md
     * §4's transition table rejects this `(from, to)` pair. */
    transitionNotAllowed:
      'Esta transição de estado não é permitida para o problema a partir do estado atual.',
  },

  transition: {
    /** Invariant P1 — `rootCause` missing when `toStatus: RESOLVED`. */
    rootCauseRequired: 'A causa raiz é obrigatória para marcar o problema como resolvido.',
    /** `TransitionProblemRequest.cancellationReason`'s `required` when
     * `toStatus: CANCELLED`. */
    cancellationReasonRequired: 'O motivo do cancelamento é obrigatório.',
    /** `TransitionProblemRequest.reopenReason`'s `required` when reopening
     * (`RESOLVED -> IN_ANALYSIS`). */
    reopenReasonRequired: 'O motivo da reabertura é obrigatório.',
  },

  close: {
    /** Invariant P2 — no completed corrective `Action` (`originType:
     * PROBLEM`) exists yet for this problem. */
    requirementNotMet: 'O encerramento exige uma ação corretiva concluída para este problema.',
    /** Invariant P3 — segregation of duties: the closer completed the
     * qualifying corrective action themselves. */
    segregationOfDuties:
      'Quem concluiu a ação corretiva não pode encerrar o problema. Solicite que outra pessoa ' +
      'com permissão de transição realize esta ação.',
  },

  link: {
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este problema.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',

    incidentNotFound: 'Incidente não encontrado ou fora do escopo do usuário.',
    incidentAlreadyLinked: 'Este incidente já está vinculado a este problema.',
    incidentLinkNotFound: 'Vínculo com incidente não encontrado.',
    incidentLinkAlreadyWithdrawn: 'Este vínculo com incidente já foi desfeito.',
  },

  /** `NotFoundDomainError`'s `entityType` label for a link resource
   * (distinct from `entityLabel` above, which names the problem itself). */
  riskLinkEntityLabel: 'Vínculo entre problema e risco',
  incidentLinkEntityLabel: 'Vínculo entre problema e incidente',
};

/** `CreateProblemRequestDto`/`UpdateProblemRequestDto` (operations 1-2/4
 * of contracts/problems.openapi.yaml). Mirrors `controlFields`'s own
 * shape in `controls.ts`. */
export const problemFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
} as const;

/** `ListProblemsQueryDto` (`listProblems` operation). Mirrors
 * `controlCatalogQuery`'s own shape in `controls.ts`. */
export const problemCatalogQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  search: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `TransitionProblemRequestDto` (`transitionProblem` operation). */
export const problemTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  rootCause: {
    isString: 'A causa raiz deve ser um texto.',
    maxLength: 'A causa raiz deve ter no máximo 4000 caracteres.',
  },
  cancellationReason: {
    isString: 'O motivo do cancelamento deve ser um texto.',
    maxLength: 'O motivo do cancelamento deve ter no máximo 2000 caracteres.',
  },
  reopenReason: {
    isString: 'O motivo da reabertura deve ser um texto.',
    maxLength: 'O motivo da reabertura deve ter no máximo 2000 caracteres.',
  },
} as const;

/** `LinkProblemRiskRequestDto` (US3, operation `linkProblemToRisk`). */
export const linkProblemRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;

/** `LinkProblemIncidentRequestDto` (US3, operation `linkProblemToIncident`). */
export const linkProblemIncidentFields = {
  incidentId: { isUuid: 'O incidente informado é inválido.' },
} as const;
