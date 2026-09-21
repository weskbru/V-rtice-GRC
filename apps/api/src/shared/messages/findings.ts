/**
 * T003/002-shared-grc-foundation — Finding (US3). See `evidence.ts`'s
 * header for the full explanation of the modular mechanism and the
 * enum-label-map convention this file follows identically.
 *
 * `severityLabels`/`priorityLabels` are deliberately separate maps, even
 * though `FindingSeverity`/`FindingPriority` share the same four LOW/
 * MEDIUM/HIGH/(CRITICAL|URGENT) shape — R-005: severity (gravity of the
 * fact) and priority (urgency to treat) are distinct GRC concepts that
 * must never collapse into one, in the data model or in the vocabulary
 * shown to a user.
 */
import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export const findings = {
  categoryLabels: {
    NONCONFORMITY: 'Não conformidade',
    CONTROL_DEFICIENCY: 'Deficiência de controle',
    OBSERVATION: 'Observação',
    IMPROVEMENT_OPPORTUNITY: 'Oportunidade de melhoria',
  } satisfies Record<FindingCategory, string>,

  originLabels: {
    INTERNAL_ASSESSMENT: 'Autoavaliação interna',
    CONTROL_TESTING: 'Teste de controle',
    MANAGEMENT_REVIEW: 'Revisão da administração',
  } satisfies Record<FindingOrigin, string>,

  /** Gravity of the fact — distinct from `priorityLabels` (R-005). */
  severityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  } satisfies Record<FindingSeverity, string>,

  /** Urgency of treatment — distinct from `severityLabels` (R-005). */
  priorityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  } satisfies Record<FindingPriority, string>,

  statusLabels: {
    OPEN: 'Aberto',
    IN_REMEDIATION: 'Em remediação',
    CLOSED: 'Encerrado',
    ARCHIVED: 'Arquivado',
  } satisfies Record<FindingStatus, string>,

  /** `NotFoundDomainError`'s `entityType` label (FR-032, SC-005) — appears
   * verbatim in `problem+json`'s `detail` ("Achado {id} não foi
   * encontrado(a)."). */
  entityLabel: 'Achado',

  /** Referential integrity on `ownerUserId` (FR-021). */
  ownerNotFound: 'Usuário responsável pelo achado não encontrado ou inativo.',
  /** FR-031 — the org unit supplied at creation does not exist, is
   * inactive, or is outside the caller's scope. Assurance fix (confirmed
   * breach): used for ALL three causes, deliberately — a scope-limited
   * caller must not be able to tell "does not exist" apart from "outside
   * my scope" (this endpoint's own "answered as not-found" contract
   * promise), so there is no separate `orgUnitOutOfScope` message here
   * (unlike `risk.ts`, whose OWN contract makes no such promise). See
   * `grc/evidence/application/create-evidence.usecase.ts`'s header for the
   * full reasoning — this mirrors that fix exactly. */
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  /** Request-shape: `PATCH` body with no fields to change. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  /** Phase 6 correction (D-11-adjacent consistency fix) — mirrors
   * `evidence.ts#archivedNotEditable` exactly: an `ARCHIVED` finding's
   * descriptive fields are frozen, the same reasoning FR-009 already gives
   * for `Evidence`. `CLOSED` is deliberately NOT covered by this message —
   * a closed finding stays editable, because post-closure correction is
   * legitimate and nothing in the spec forbids it. */
  archivedNotEditable: 'Não é possível editar um achado arquivado.',

  transition: {
    /** `finding.entity.ts#assertLegalFindingTransition` — data-model.md
     * §5's transition table rejects this `(from, to)` pair (also carries
     * Invariant F4: archiving a finding that is not `CLOSED`). */
    notAllowed: 'Esta transição de estado não é permitida para o achado a partir do estado atual.',
  },

  close: {
    /** Invariant F1 — neither a completed linked action nor a
     * justification was provided. */
    requirementNotMet:
      'O encerramento exige ao menos uma ação vinculada concluída ou uma justificativa.',
    /** Invariant F2 — segregation of duties: the closer is the responsible
     * user of a completed action linked to this finding. */
    segregationOfDuties:
      'Quem executou a remediação não pode encerrar o achado. Solicite que outra pessoa com ' +
      'permissão de encerramento realize esta ação.',
    /** Invariant F5 (T050/005-audit-findings, FR-010) — no ACTIVE evidence
     * link sustains this closure. Additive to `requirementNotMet` above:
     * both invariants must be satisfied, never one substituting the
     * other. */
    evidenceRequired: 'O encerramento exige ao menos uma evidência vinculada e ativa ao achado.',
  },

  reopen: {
    /** `ReopenFindingRequest`'s `required: [reason]`, re-checked in the
     * domain (Invariant, `finding.entity.ts#assertReopenReasonProvided`). */
    reasonRequired: 'Informe o motivo da reabertura.',
  },

  /** T062-T065/005-audit-findings, US3 — `Finding ↔ Control`/
   * `Finding ↔ Risk` (research.md D-4, ADR-020 parts 4/5). The SAME
   * message serves "does not exist", "is not active/is archived", "lies
   * outside the caller's organizational scope" and "the actor lacks
   * control:view/risk:view" — the four causes ADR-020 part 4/5 require to
   * be indistinguishable from one another (SC-006). */
  link: {
    controlNotFound: 'Controle não encontrado, inativo ou fora do escopo do usuário.',
    controlAlreadyLinked: 'Este controle já está vinculado a este achado.',
    controlLinkNotFound: 'Vínculo com controle não encontrado.',
    controlLinkAlreadyWithdrawn: 'Este vínculo com controle já foi desfeito.',
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este achado.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',
  },

  /** `NotFoundDomainError`'s `entityType` label for a link resource
   * (distinct from `entityLabel` above, which names the finding itself). */
  controlLinkEntityLabel: 'Vínculo entre achado e controle',
  riskLinkEntityLabel: 'Vínculo entre achado e risco',
} as const;

/** `CreateFindingRequestDto`/`UpdateFindingRequestDto` (T073). */
export const findingFields = {
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  recommendation: { maxLength: 'A recomendação deve ter no máximo 4000 caracteres.' },
  category: { isIn: 'A categoria informada é inválida.' },
  origin: { isIn: 'A origem informada é inválida.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  priority: { isIn: 'A prioridade informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
} as const;

/** `ListFindingQueryDto` (T073). */
export const findingListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  withoutRemediation: { isBoolean: 'O filtro de remediação informado é inválido.' },
} as const;

/** `CloseFindingRequestDto` (T073). */
export const closeFindingFields = {
  justification: { maxLength: 'A justificativa deve ter no máximo 4000 caracteres.' },
} as const;

/** `ReopenFindingRequestDto` (T073). */
export const reopenFindingFields = {
  reason: {
    isString: 'O motivo deve ser um texto.',
    length: 'O motivo deve ter entre 1 e 4000 caracteres.',
  },
} as const;

/** `CreateFindingControlLinkRequestDto` (T062/005-audit-findings). */
export const linkFindingControlFields = {
  controlId: { isUuid: 'O controle informado é inválido.' },
} as const;

/** `CreateFindingRiskLinkRequestDto` (T065/005-audit-findings). */
export const linkFindingRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;
