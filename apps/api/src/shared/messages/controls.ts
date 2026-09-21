/**
 * T018/003-controls-management — Controls Management's own pt-BR message
 * catalog (CLAUDE.md §11.1: every new user-facing string lives in a
 * centralized catalog, never inline in a component or domain file).
 * Follows `action.ts`'s own precedent: strings are added at the point they
 * are actually needed by this task's own domain code
 * (`control-lifecycle.ts`'s precondition evaluators), not invented ahead
 * of the use cases/DTOs a later task (T020+) will add.
 *
 * T027-T042/003-controls-management, User Story 2/3 — extended with the
 * assessment/attestation and process/asset relationship strings, following
 * `findings.ts`'s own convention of one file per module composed into
 * `USER_MESSAGES` (see that file's own header).
 */
export const controls = {
  entityLabel: 'Controle',
  assessmentEntityLabel: 'Verificação',
  attestationEntityLabel: 'Atestação',
  processLinkEntityLabel: 'Vínculo com processo',
  assetLinkEntityLabel: 'Vínculo com ativo',
  processEntityLabel: 'Processo',
  assetEntityLabel: 'Ativo',

  // T020-T024/003-controls-management, User Story 1 — catalog, record and
  // lifecycle write-path messages (operations 1-6 of
  // contracts/controls.openapi.yaml). Mirrors the equivalent `risk`
  // catalog messages in `risk.ts` exactly (`orgUnitNotFound`/
  // `orgUnitOutOfScope`/`ownerNotFound`/`ownerNotAssignable`/
  // `ifMatchRequired`/`ifMatchInvalid`/`updateRequestEmpty`).
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  ownerNotFound: 'Usuário informado como dono não encontrado ou inativo.',
  ownerNotAssignable:
    'O usuário informado como dono não pertence à linha organizacional desta unidade.',
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para esta operação.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    /** `PerformControlTransitionUseCase` — no row in
     * `CONTROL_LIFECYCLE_TRANSITIONS` matches `(current status, toStatus)`
     * (D-6, FR-081-equivalent). */
    transitionNotAllowed: 'Esta transição não é permitida a partir do estado atual do controle.',
    preconditions: {
      /** `control-lifecycle.ts`'s `HAS_OWNER` precondition — FR-005: a
       * control requires a defined owner to enter `ACTIVE`. */
      hasOwner: 'O controle precisa ter um dono definido para entrar em operação.',
      /** `control-lifecycle.ts`'s `HAS_JUSTIFICATION` precondition — US1
       * AS3: descontinuar um controle exige justificativa. */
      hasJustification: 'Informe a justificativa para descontinuar o controle.',
    },
  },

  assessment: {
    /** FR-011 — a verification records what was observed, never what has
     * yet to happen. */
    assessedOnInFuture: 'A data da verificação não pode ser futura.',
    /** D-6/FR-006 — `createControlAssessment` requires the control to be
     * `ACTIVE`; `DRAFT`, `SUSPENDED` and `RETIRED` all refuse new
     * verifications. */
    controlNotActive: 'O controle precisa estar em operação (ACTIVE) para receber verificações.',

    attestation: {
      /** D-8 — an assessment admits at most one attestation lifecycle,
       * ever; requesting again (pending or already decided) is refused. */
      alreadyRequested: 'Esta verificação já possui uma atestação solicitada ou decidida.',
      /** FR-016 — deciding an attestation that was never requested. */
      notRequested: 'Nenhuma atestação foi solicitada para esta verificação.',
      /** Deciding an attestation that has already been decided. */
      alreadyDecided: 'Esta atestação já foi decidida.',
      /** C1 (research.md D-3, FR-017) — the assessor may not attest their
       * own verification. */
      segregationAssessor: 'Quem executou a verificação não pode atestar o próprio resultado.',
      /** C2 (research.md D-3, FR-018) — the control's owner may not attest
       * verifications of their own control. */
      segregationOwner: 'O dono do controle não pode atestar verificações do próprio controle.',
      /** Both C1 and C2 apply to the same person — named together, never
       * merged into a single generic reason (spec edge case "atestação por
       * quem acumula papéis"). */
      segregationBoth:
        'Quem executou a verificação não pode atestar o próprio resultado, e o dono do ' +
        'controle não pode atestar verificações do próprio controle; esta pessoa acumula os ' +
        'dois papéis.',
    },
  },

  relationships: {
    /** FR-006 — a `RETIRED` control accepts no new process/asset links. */
    controlRetired: 'O controle está descontinuado e não aceita novos vínculos.',
    /** FR-025 — the referenced process/asset is missing or outside the
     * caller's organizational scope; answered exactly as nonexistent. */
    processNotFound: 'Processo não encontrado.',
    assetNotFound: 'Ativo não encontrado.',
    /** Edge case "vínculo duplicado" — an already-ACTIVE link for the same
     * pair; a withdrawn one may be relinked. */
    processAlreadyLinked: 'Este controle já está vinculado a este processo.',
    assetAlreadyLinked: 'Este controle já está vinculado a este ativo.',
    /** FR-023 — withdrawing a link that was already withdrawn. */
    linkAlreadyWithdrawn: 'Este vínculo já foi desfeito.',
  },
} as const;

/** `CreateControlAssessmentRequestDto` (T033). */
export const controlAssessmentFields = {
  assessedOn: { isDateString: 'A data da verificação informada é inválida.' },
  result: { isIn: 'O resultado informado é inválido.' },
  conclusion: {
    isString: 'A conclusão deve ser um texto.',
    length: 'A conclusão deve ter entre 1 e 8000 caracteres.',
  },
} as const;

/** `ControlAssessmentAttestationDecisionRequestDto` (T033). */
export const controlAssessmentAttestationDecisionFields = {
  decision: { isIn: 'A decisão informada é inválida.' },
  justification: { maxLength: 'A justificativa deve ter no máximo 2000 caracteres.' },
} as const;

/** `CreateControlRequestDto`/`UpdateControlRequestDto` (T023,
 * operations 1-2/4 of contracts/controls.openapi.yaml). Mirrors
 * `riskFields`'s own shape in `risk.ts`. */
export const controlFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  nature: { isIn: 'A natureza informada é inválida.' },
  type: { isIn: 'O tipo informado é inválido.' },
  frequency: { isIn: 'A frequência informada é inválida.' },
} as const;

/** `ListControlsQueryDto` (T023, `listControlCatalog` operation). Mirrors
 * `riskRegisterQuery`'s own shape in `risk.ts`. */
export const controlCatalogQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  effectiveness: { isIn: 'A efetividade informada é inválida.' },
  nature: { isIn: 'A natureza informada é inválida.' },
  type: { isIn: 'O tipo informado é inválido.' },
  frequency: { isIn: 'A frequência informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `TransitionControlRequestDto` (T023, `transitionControl` operation). */
export const controlTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;
