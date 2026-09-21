/**
 * T023-T037/005-audit-findings — Audit Engagements' own pt-BR message
 * catalog (CLAUDE.md §11.1: every new user-facing string lives in a
 * centralized catalog, never inline in a component or domain file).
 * Follows `controls.ts`'s own precedent — one file per business module,
 * composed into `USER_MESSAGES` in `user-messages.ts`.
 */
export const auditEngagements = {
  entityLabel: 'Engajamento de auditoria',
  scopeFrameworkVersionEntityLabel: 'Vínculo de escopo com versão de framework',
  scopeRequirementEntityLabel: 'Vínculo de escopo com requisito',
  scopeControlEntityLabel: 'Vínculo de escopo com controle',

  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  leadAuditorNotFound: 'Usuário informado como responsável não encontrado ou inativo.',
  periodEndBeforeStart: 'O fim do período não pode ser anterior ao início.',
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para esta operação.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    /** `assertLegalAuditEngagementTransition` — no row in the lifecycle
     * table matches `(current status, toStatus)` (research.md D-3,
     * amended FR-004a). */
    transitionNotAllowed: 'Esta transição não é permitida a partir do estado atual do engajamento.',
    /** FR-003 — starting requires at least one scope link, in any of the
     * three scope tables. */
    startRequiresScope:
      'O engajamento precisa ter ao menos um vínculo de escopo para ser iniciado.',
    /** `assertAuditEngagementEditable` — `PATCH`/scope links are only
     * permitted while `PLANNING` (research.md D-3, D-13). */
    editableOnlyWhilePlanning:
      'O engajamento só pode ser editado ou ter seu escopo alterado enquanto está em planejamento.',
    /** `assertAuditEngagementAcceptsFindings` — FR-004/FR-007: a
     * `PLANNING` or `COMPLETED`/`CANCELLED` engagement never accepts a new
     * finding. */
    findingsRequireInProgress:
      'O engajamento precisa estar em execução para receber achados novos.',
    /** FR-004a — the discard path requires a written justification. */
    cancellationJustificationRequired: 'Informe a justificativa para descartar o engajamento.',
  },

  scope: {
    /** `LinkAuditScopeToFrameworkVersionUseCase`/`...RequirementUseCase`/
     * `...ControlUseCase` — one message per target kind, deliberately
     * covering "does not exist", "not in a linkable state" (unpublished
     * version / inactive control) AND "actor lacks the referenced-side
     * view permission" INDISTINGUISHABLY (ADR-020 parts 4/5, research.md
     * D-2/D-11) — the same "OrOutOfScope"-style collapsed message shape
     * `compliance`'s own `requirementControlLink.controlNotFoundOrOutOfScope`
     * already establishes. */
    frameworkVersionNotFound: 'Versão de framework não encontrada ou não publicada.',
    requirementNotFound: 'Requisito não encontrado ou de versão ainda não publicada.',
    controlNotFound: 'Controle não encontrado.',
    /** Edge case "vínculo de escopo duplicado". */
    frameworkVersionAlreadyInScope: 'Esta versão de framework já está no escopo deste engajamento.',
    requirementAlreadyInScope: 'Este requisito já está no escopo deste engajamento.',
    controlAlreadyInScope: 'Este controle já está no escopo deste engajamento.',
  },
} as const;

/** `CreateAuditEngagementRequestDto`/`UpdateAuditEngagementRequestDto` (T040). */
export const auditEngagementFields = {
  objective: {
    isString: 'O objetivo deve ser um texto.',
    length: 'O objetivo deve ter entre 1 e 2000 caracteres.',
  },
  periodStart: { isDateString: 'A data de início do período informada é inválida.' },
  periodEnd: { isDateString: 'A data de fim do período informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  leadAuditorUserId: { isUuid: 'O responsável informado é inválido.' },
} as const;

/** `CancelAuditEngagementRequestDto` (T034a). */
export const cancelAuditEngagementFields = {
  justification: {
    isString: 'A justificativa deve ser um texto.',
    length: 'A justificativa deve ter entre 1 e 2000 caracteres.',
  },
} as const;

/** `ListAuditEngagementsQueryDto` (T040, `listAuditEngagements` operation).
 * Mirrors `controlCatalogQuery`'s own shape in `controls.ts`. */
export const listAuditEngagementsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  leadAuditorUserId: { isUuid: 'O responsável informado é inválido.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `AddFrameworkVersionScopeRequestDto` (T040, `addFrameworkVersionToScope`
 * operation). */
export const addFrameworkVersionScopeFields = {
  frameworkVersionId: {
    isUuid: 'O identificador da versão de framework (frameworkVersionId) deve ser um UUID válido.',
  },
} as const;

/** `AddRequirementScopeRequestDto` (T040, `addRequirementToScope`
 * operation). */
export const addRequirementScopeFields = {
  requirementId: {
    isUuid: 'O identificador do requisito (requirementId) deve ser um UUID válido.',
  },
} as const;

/** `AddControlScopeRequestDto` (T040, `addControlToScope` operation). */
export const addControlScopeFields = {
  controlId: {
    isUuid: 'O identificador do controle (controlId) deve ser um UUID válido.',
  },
} as const;
