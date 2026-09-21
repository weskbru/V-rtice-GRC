import type { ApprovalStatus, RiskLevel, RiskStatus, TreatmentStrategy } from '@prisma/client';

/** Risk Management (US2, T086-T092) — the first business module. */
export const risk = {
  /** FR-084: `CLOSED`/`ARCHIVED` risks reject business-content edits. */
  businessContentLocked:
    'Não é possível editar o conteúdo de negócio de um risco encerrado ou arquivado.',
  /** FR-055: fields required to leave `DRAFT`. */
  draftIncomplete: {
    title: 'O título é obrigatório para o risco sair do rascunho.',
    description: 'A descrição é obrigatória para o risco sair do rascunho.',
    category: 'A categoria é obrigatória para o risco sair do rascunho.',
    orgUnit: 'A unidade organizacional é obrigatória para o risco sair do rascunho.',
    owner: 'O gestor do risco é obrigatório para o risco sair do rascunho.',
  },
  /** FR-025c: creation/reassignment outside the caller's authorized scope. */
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  /** FR-059/FR-060: referential integrity on referenced records. */
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  ownerNotFound: 'Usuário gestor do risco não encontrado ou inativo.',
  responsibleNotFound: 'Usuário responsável não encontrado ou inativo.',
  /** The assignment line rule (`core/organizations/domain/
   * assignment-line.ts`): an active user whose primary organizational unit
   * is not the risk's own unit, an ancestor or a descendant of it may not be
   * made owner/responsible for the risk. Deliberately silent about WHY —
   * never names the unit the caller assigned, and never discloses that
   * other, assignable users exist. */
  ownerNotAssignable:
    'Usuário gestor do risco não pertence à linha organizacional da unidade do risco.',
  responsibleNotAssignable:
    'Usuário responsável não pertence à linha organizacional da unidade do risco.',
  /** F-CV-2: the assignment-line check above proves organizational lineage,
   * not that the candidate can actually see the risk once assigned to it —
   * visibility is `risk:view` plus scope reaching the risk's own unit, a
   * different question (`AssignmentLineService.isQuestionInScope`, the same
   * predicate `GET /risks/{id}` is gated by). Deliberately silent about
   * which of the two conditions failed, and never names a permission
   * identifier — a user reading this message learns THAT the candidate
   * cannot be assigned, not the mechanics of why. */
  ownerNotVisible:
    'Usuário gestor do risco não tem condições de visualizar riscos nesta unidade organizacional.',
  responsibleNotVisible:
    'Usuário responsável não tem condições de visualizar riscos nesta unidade organizacional.',
  categoryNotFound: 'Categoria de risco não encontrada ou inativa.',
  typeNotFound: 'Tipo de risco não encontrado ou inativo.',
  originNotFound: 'Origem de risco não encontrada ou inativa.',
  /** ADR-013: `If-Match` header handling. */
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para atualizar um risco.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  versionConflict: 'O risco foi modificado por outro usuário. Recarregue e tente novamente.',
  /** Request-shape: PATCH body with no fields to change. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  /** Risk Assessment (US4, T121-T126). */
  assessment: {
    /** FR-067: a factor value outside the configured scale. */
    probabilityOutOfScale: 'O valor de probabilidade informado não pertence à escala configurada.',
    impactOutOfScale: 'O valor de impacto informado não pertence à escala configurada.',
    /** FR-068/US4 AS5: a supplied `methodologyVersionId` that is not the
     * currently active version. */
    methodologyVersionNotActive:
      'A versão da metodologia informada não é mais a versão ativa. Recarregue a avaliação e tente novamente.',
    assessedOnInFuture: 'A data da avaliação não pode ser no futuro.',
  },

  /** Risk Methodology configuration (US4, T121/T126). */
  methodology: {
    noActiveMethodology: 'Nenhuma metodologia de risco ativa foi configurada.',
    invalidConfiguration: 'A configuração da metodologia de risco informada é inválida.',
    scaleEmpty: 'A escala não pode ser vazia.',
    scaleNotOrdered:
      'A escala deve estar ordenada de forma crescente por valor, sem valores repetidos.',
    matrixMissingCell:
      'A matriz de risco não cobre todas as combinações de probabilidade e impacto declaradas nas escalas.',
    matrixUnknownCell:
      'A matriz de risco contém uma célula fora dos valores declarados nas escalas.',
    matrixDuplicateCell: 'A matriz de risco contém uma célula duplicada.',
    bandsEmpty: 'As faixas de nível de risco não podem ser vazias.',
    bandsInvalidLevel: 'Uma faixa de nível de risco informa um nível de risco inválido.',
    bandsInvalidRange: 'Uma faixa de nível de risco tem o valor mínimo maior que o valor máximo.',
    bandsNotOrdered: 'As faixas de nível de risco devem estar ordenadas de forma crescente.',
    bandsOverlapOrGap: 'As faixas de nível de risco devem ser contíguas e não podem se sobrepor.',
    bandsCoverageMismatch:
      'As faixas de nível de risco devem cobrir integralmente a faixa de pontuação alcançável pela matriz.',
    matrixBandMismatch:
      'O nível declarado em uma célula da matriz não corresponde à faixa de nível de risco correspondente à sua pontuação.',
  },

  /** Risk Treatment and Relationships (US5, T139-T143). */
  treatment: {
    decisionNotFound: 'A decisão de tratamento informada não foi encontrada para este risco.',
    /** ADR-020 parts 4/5 — the SAME message answers a control that does
     * not exist, is inactive, sits outside the actor's organizational
     * scope, or that the actor lacks `control:view` for (F-46,
     * `docs/deferred-findings.md`) — the four causes must never be
     * distinguishable by wording. */
    controlNotFound:
      'O controle informado não existe, está inativo ou está fora do escopo do usuário.',
    controlAlreadyLinked: 'Este controle já está associado a este risco.',
    processNotFound: 'O processo informado não foi encontrado ou está inativo.',
    processAlreadyLinked: 'Este processo já está associado a este risco.',
    assetNotFound: 'O ativo informado não foi encontrado ou está inativo.',
    assetAlreadyLinked: 'Este ativo já está associado a este risco.',
  },

  /** Risk Lifecycle and Approvals (US6, T147-T162, ADR-006). */
  lifecycle: {
    /** FR-081: `(from, to)` absent from the declarative transition table. */
    transitionNotAllowed:
      'Esta transição de status não é permitida a partir do status atual do risco.',
    /** FR-029: `ACCEPTED`/`CLOSED` targets must be requested via the
     * approvals endpoint, never applied directly. */
    transitionRequiresApproval:
      'Esta transição requer aprovação. Solicite-a pelo endpoint de aprovações.',
    /** FR-029: the inverse of the above — `RequestApprovalUseCase` refuses
     * a `toStatus` that is not one of the gated transitions. */
    transitionNotApprovalGated:
      'Esta transição não requer aprovação e não pode ser solicitada como uma aprovação.',
    /** `TransitionPreconditionId`-keyed messages
     * (`domain/transition-preconditions.ts`, T155) — one per evaluator,
     * phrased for display (FR-081, US6 AS3). */
    preconditions: {
      draftFieldsIncomplete:
        'É necessário completar título, descrição, categoria, unidade organizacional e gestor para sair do rascunho.',
      hasAssessment: 'É necessário haver ao menos uma avaliação registrada para esta transição.',
      hasTreatmentDecision:
        'É necessário haver uma decisão de tratamento registrada para esta transição.',
      reassessedDuringReview:
        'É necessário registrar uma nova avaliação durante a revisão antes de retornar ao status avaliado.',
    },
    /** FR-029c/409: a second approval request while one is still pending. */
    approvalAlreadyPending: 'Já existe uma aprovação pendente para este risco.',
    /** FR-029b/409: a second decision on an already-decided approval. */
    approvalAlreadyDecided: 'Esta aprovação já foi decidida e não pode ser alterada.',
    /** FR-029a/422 — segregation of duties (`domain/approval.ts`). */
    approvalSelfApproval:
      'O usuário que solicitou esta transição não pode decidir sua própria solicitação.',
    /** The `approvalId` path parameter does not name a pending approval
     * request belonging to this risk. */
    approvalNotFound: 'Aprovação não encontrada para este risco.',
    /** ADR-006: the decision endpoint re-evaluates the gated transition
     * against the risk's CURRENT status — refused if it is no longer
     * valid from there. */
    approvalTransitionNoLongerValid:
      'A transição solicitada não é mais válida a partir do status atual do risco.',
  },

  /** Risk History (US7, T166) — `RiskHistoryEntry.summary`/
   * `previousValue`/`newValue` (`contracts/risks.openapi.yaml`, ADR-006).
   * Built by `RiskHistoryQueryService` from the raw fields of each merged
   * source row. See `user-messages.ts`'s header for why these are here
   * despite populating a SUCCESS response, not an error body. */
  history: {
    levelLabels: {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      CRITICAL: 'Crítico',
    } satisfies Record<RiskLevel, string>,
    statusLabels: {
      DRAFT: 'Rascunho',
      IDENTIFIED: 'Identificado',
      ASSESSED: 'Avaliado',
      UNDER_TREATMENT: 'Em tratamento',
      UNDER_REVIEW: 'Em revisão',
      ACCEPTED: 'Aceito',
      CLOSED: 'Encerrado',
      ARCHIVED: 'Arquivado',
    } satisfies Record<RiskStatus, string>,
    treatmentStrategyLabels: {
      MITIGATE: 'Mitigar',
      AVOID: 'Evitar',
      TRANSFER: 'Transferir',
      ACCEPT: 'Aceitar',
    } satisfies Record<TreatmentStrategy, string>,
    approvalStatusLabels: {
      PENDING: 'Pendente',
      APPROVED: 'Aprovada',
      REJECTED: 'Rejeitada',
    } satisfies Record<ApprovalStatus, string>,
    /** `residualLabel`/`inherentLabel` are already-resolved
     * `levelLabels` values. */
    assessmentRecorded: (residualLabel: string, inherentLabel: string): string =>
      `Nova avaliação registrada — risco residual ${residualLabel}, risco inerente ${inherentLabel}.`,
    /** `strategyLabel` is an already-resolved `treatmentStrategyLabels`
     * value. */
    treatmentDecisionRecorded: (strategyLabel: string): string =>
      `Decisão de tratamento registrada: ${strategyLabel}.`,
    /** `fromLabel`/`toLabel` are already-resolved `statusLabels` values. */
    lifecycleTransitionOccurred: (fromLabel: string, toLabel: string): string =>
      `O risco transicionou de "${fromLabel}" para "${toLabel}".`,
    /** `toLabel` is an already-resolved `statusLabels` value. */
    approvalRequested: (toLabel: string): string =>
      `Aprovação solicitada para a transição para "${toLabel}".`,
    approvalApproved: (toLabel: string): string =>
      `Aprovação concedida — transição para "${toLabel}" aplicada.`,
    approvalRejected: 'Aprovação rejeitada.',
    /** `previousName`/`newName` are the previous/new owner's `fullName`. */
    ownershipChanged: (previousName: string, newName: string): string =>
      `Gestor do risco alterado de ${previousName} para ${newName}.`,
    ownershipSet: (newName: string): string => `Gestor do risco definido como ${newName}.`,
  },

  /** GRC Dashboard (T197, FR-049, FR-070) — `DashboardRiskItem.dueContext`
   * for the items-requiring-review tile. `approvalRequested` above
   * (`risk.history`) is reused verbatim for the pending-approvals tile's
   * own `dueContext`, rather than a second, near-identical string here. */
  dashboard: {
    /**
     * `dateOnly` arrives as `YYYY-MM-DD` (`nextReviewOn` is stored `@db.Date`).
     *
     * It is reformatted to `DD/MM/YYYY` before being interpolated. An earlier
     * version reasoned that a date with no time component had "nothing to
     * localize" and interpolated the ISO string directly — which put
     * "Revisão vencida desde 2025-05-05." on the dashboard beside a sibling
     * card rendering "01/01/2020", two date formats in one screenshot. A
     * date-only value still has a *format*, and pt-BR is not ISO.
     *
     * Reformatted by splitting the string, never by constructing a `Date`:
     * `new Date('2025-05-05')` parses as UTC midnight and renders as the
     * previous day west of Greenwich — a bug this product has already shipped
     * once and fixed in `apps/web/src/features/risks/date.ts`.
     */
    reviewOverdueSince: (dateOnly: string): string => {
      const [year, month, day] = dateOnly.split('-');
      const formatted = year && month && day ? `${day}/${month}/${year}` : dateOnly;
      return `Revisão vencida desde ${formatted}.`;
    },
  },

  /** 002-shared-grc-foundation, US1 — `RiskEvidenceSubjectAccessor`'s
   * `EvidenceLink.subjectLabel` templates (`grc/shared/domain/ports
   * /evidence-subject-resolver.port.ts`'s `EvidenceSubjectAccess.label`).
   * Lives here, not in `grc/**`, because only the risk module knows how to
   * label its own records (the same reasoning `entity-registry.ts`'s own
   * header gives for every accessor being the owning module's code). */
  evidenceSubject: {
    riskLabel: (code: string, title: string): string => `${code} — ${title}`,
    treatmentDecisionLabel: (riskCode: string, strategyLabel: string): string =>
      `Decisão de tratamento (${strategyLabel}) — ${riskCode}`,
  },
} as const;

/** `CreateRiskRequestDto`/`UpdateRiskRequestDto` (T091). */
export const riskFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  categoryId: { isUuid: 'A categoria informada é inválida.' },
  typeId: { isUuid: 'O tipo informado é inválido.' },
  originId: { isUuid: 'A origem informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O gestor do risco informado é inválido.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
  nextReviewOn: { isDateString: 'A data da próxima revisão informada é inválida.' },
  causes: {
    isString: 'Cada causa deve ser um texto.',
    minLength: 'A causa não pode ser vazia.',
  },
  consequences: {
    isString: 'Cada consequência deve ser um texto.',
    minLength: 'A consequência não pode ser vazia.',
  },
} as const;

/** `ReplaceRiskStatementsRequestDto` (T093,
 * `PUT /risks/{riskId}/causes|consequences`) — shared verbatim by both
 * endpoints, matching `contracts/risks.openapi.yaml`'s single
 * `ReplaceRiskStatementsRequest` schema for both. */
export const riskStatementItems = {
  isArray: 'A lista de itens é obrigatória.',
  isString: 'Cada item deve ser um texto.',
  minLength: 'O item não pode ser vazio.',
  arrayMaxSize: 'A lista pode ter no máximo 50 itens.',
} as const;

/** `CreateAssessmentRequestDto` (T125, `POST /risks/{riskId}/assessments`). */
export const assessment = {
  assessedOn: { isDateString: 'A data da avaliação informada é inválida.' },
  inherentProbability: { isInt: 'A probabilidade inerente informada é inválida.' },
  inherentImpact: { isInt: 'O impacto inerente informado é inválido.' },
  residualProbability: { isInt: 'A probabilidade residual informada é inválida.' },
  residualImpact: { isInt: 'O impacto residual informado é inválido.' },
  controlIdsConsidered: { isUuid: 'Um dos controles informados é inválido.' },
  rationale: { isString: 'A justificativa deve ser um texto.' },
  methodologyVersionId: { isUuid: 'A versão de metodologia informada é inválida.' },
  nextReviewOn: { isDateString: 'A data da próxima revisão informada é inválida.' },
} as const;

/** `ListAssessmentsQueryDto`/`ListMethodologyVersionsQueryDto` (T125/T126). */
export const pageQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

/** `CreateMethodologyVersionRequestDto` (T126,
 * `POST /risk-methodology/versions`). */
export const methodology = {
  probabilityScale: { arrayMinSize: 'A escala de probabilidade deve ter ao menos 2 valores.' },
  impactScale: { arrayMinSize: 'A escala de impacto deve ter ao menos 2 valores.' },
  matrix: { arrayMinSize: 'A matriz de risco deve ter ao menos 4 células.' },
  levelBands: { arrayMinSize: 'As faixas de nível de risco devem ter ao menos 2 faixas.' },
  effectiveFrom: { isDateString: 'A data de vigência informada é inválida.' },
  scalePoint: {
    value: { isInt: 'O valor do ponto de escala informado é inválido.' },
    label: { isString: 'O rótulo do ponto de escala deve ser um texto.' },
  },
  matrixCell: {
    probability: { isInt: 'A probabilidade da célula da matriz informada é inválida.' },
    impact: { isInt: 'O impacto da célula da matriz informado é inválido.' },
    score: { isInt: 'A pontuação da célula da matriz informada é inválida.' },
    level: { isIn: 'O nível de risco da célula da matriz informado é inválido.' },
  },
  levelBand: {
    level: { isIn: 'O nível de risco da faixa informado é inválido.' },
    minScore: { isInt: 'A pontuação mínima da faixa informada é inválida.' },
    maxScore: { isInt: 'A pontuação máxima da faixa informada é inválida.' },
  },
} as const;

/** `ReferenceDataQueryDto` — `GET /risk-categories|risk-types|risk-origins`. */
export const referenceDataQuery = {
  includeInactive: { isBoolean: 'O parâmetro includeInactive deve ser verdadeiro ou falso.' },
} as const;

/** `CreateRiskTreatmentDecisionRequestDto` (T143,
 * `POST /risks/{riskId}/treatments`). */
export const treatmentDecision = {
  strategy: { isIn: 'A estratégia de tratamento informada é inválida.' },
  description: {
    isString: 'A descrição/justificativa deve ser um texto.',
    minLength: 'A descrição/justificativa não pode ser vazia.',
  },
  deadline: { isDateString: 'O prazo informado é inválido.' },
} as const;

/** `CreateRiskTreatmentActionRequestDto`/`UpdateRiskTreatmentActionRequestDto`
 * (T143, `/risks/{riskId}/treatment-actions[/{actionId}]`). */
export const treatmentAction = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: { isString: 'A descrição deve ser um texto.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  dueOn: { isDateString: 'A data de vencimento informada é inválida.' },
  treatmentDecisionId: { isUuid: 'A decisão de tratamento informada é inválida.' },
  status: { isIn: 'O status informado é inválido.' },
  /** 007-implementation-remediation, Frente A, D-3 — `reopenReason` on
   * `UpdateRiskTreatmentActionRequest`, required when `status: OPEN`
   * reopens a `COMPLETED` action. Validation string only; the substantive
   * "reason required to reopen" rule stays enforced once, in
   * `grc/action/domain/action.entity.ts#assertReopenReasonProvided`
   * (`USER_MESSAGES.action.transition.reopenReasonRequired`) — this key is
   * only for the DTO's own type check. */
  reopenReason: { isString: 'O motivo da reabertura deve ser um texto.' },
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  overdue: { isBoolean: 'O parâmetro overdue deve ser verdadeiro ou falso.' },
} as const;

/** `LinkEntityRequestDto` (T143, `POST /risks/{riskId}/controls|processes|assets`). */
export const link = {
  id: { isUuid: 'O identificador informado é inválido.' },
} as const;

/** `TransitionRiskRequestDto` (T158, `POST /risks/{riskId}/transitions`). */
export const riskTransition = {
  toStatus: { isIn: 'O status de destino informado é inválido.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

/** `RequestApprovalRequestDto` (T158, `POST /risks/{riskId}/approvals`). */
export const requestApproval = {
  toStatus: { isIn: 'O status de destino informado é inválido para solicitação de aprovação.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

/** `ApprovalDecisionRequestDto` (T158,
 * `POST /risks/{riskId}/approvals/{approvalId}/decision`). */
export const approvalDecision = {
  decision: { isIn: 'A decisão informada é inválida.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

/** `RegistryQueryDto` (T143, `GET /controls|/processes|/assets`). */
export const registryQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  includeInactive: { isBoolean: 'O parâmetro includeInactive deve ser verdadeiro ou falso.' },
} as const;

/** `ListRisksQueryDto` — `GET /risks` (T107, the risk register). */
export const riskRegisterQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  riskLevel: { isIn: 'O nível de risco informado é inválido.' },
  riskLevelBasis: { isIn: 'A base do nível de risco informada é inválida.' },
  categoryId: { isUuid: 'A categoria informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  includeDescendants: {
    isBoolean: 'O parâmetro includeDescendants deve ser verdadeiro ou falso.',
  },
  ownerUserId: { isUuid: 'O gestor do risco informado é inválido.' },
  overdueReview: { isBoolean: 'O parâmetro overdueReview deve ser verdadeiro ou falso.' },
  overdueTreatment: { isBoolean: 'O parâmetro overdueTreatment deve ser verdadeiro ou falso.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `ListRiskHistoryQueryDto` — `GET /risks/{riskId}/history` (T167,
 * US7). */
export const riskHistoryQuery = {
  type: { isIn: 'O tipo de entrada de histórico informado é inválido.' },
} as const;

/** `ListRiskAuditEventsQueryDto` — `GET /risks/{riskId}/audit-events`
 * (T168, US7). */
export const riskAuditEventsQuery = {
  action: { maxLength: 'A ação informada deve ter no máximo 100 caracteres.' },
  actorUserId: { isUuid: 'O identificador de usuário informado é inválido.' },
  occurredFrom: { isDateString: 'A data inicial informada é inválida.' },
  occurredTo: { isDateString: 'A data final informada é inválida.' },
} as const;
