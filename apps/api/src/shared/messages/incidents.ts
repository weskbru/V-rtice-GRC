/**
 * 008-incidents-problems, foundation — Incident. See `findings.ts`'s
 * header for the full explanation of the modular mechanism this file
 * follows identically (CLAUDE.md §11.1: every new user-facing string
 * lives here, in pt-BR, never inline in a component or use case).
 *
 * `link` (US3, ADR-020 parts 4/5) mirrors `findings.ts#link` exactly: the
 * SAME message serves "does not exist", "is inactive/archived", "lies
 * outside the caller's organizational scope" and "the actor lacks
 * {target}:view" — the causes ADR-020 part 4/5 require to be
 * indistinguishable from one another. `Incident -> Problem` has no write
 * path here (Problem owns that write — data-model.md §6), so there is no
 * `problemNotFound`/`problemAlreadyLinked` pair.
 *
 * `orgUnitNotFound`/`ownerNotFound` (US1, `createIncident`/`updateIncident`)
 * — same non-disclosure shape `findings.ts` establishes: existence,
 * inactive and out-of-scope all answer with this ONE message, at `422`
 * (`CreateIncidentUseCase#assertOrgUnitCreatable`'s own header).
 */
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export const incidents = {
  severityLabels: {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Média',
    LOW: 'Baixa',
  } satisfies Record<IncidentSeverity, string>,

  statusLabels: {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Resolvido',
    CLOSED: 'Encerrado',
    CANCELLED: 'Cancelado',
  } satisfies Record<IncidentStatus, string>,

  /** `NotFoundDomainError`'s `entityType` label (mirrors
   * `assets.entityLabel`'s own convention) — appears verbatim in
   * `problem+json`'s `detail` ("Incidente {id} não foi encontrado(a)."). */
  entityLabel: 'Incidente',

  /** Referential integrity on `ownerUserId` (`createIncident`/
   * `updateIncident`). */
  ownerNotFound: 'Usuário responsável pelo incidente não encontrado ou inativo.',
  /** Assurance fix pattern (`findings.ts#orgUnitNotFound`'s own header) —
   * used for existence, inactive AND out-of-scope alike, deliberately,
   * so a scope-limited caller cannot distinguish them (`createIncident`,
   * `422`, no existing record's existence could be disclosed at creation
   * time). */
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  /** `UpdateIncidentRequest`'s `minProperties: 1`. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  transition: {
    /** `incident.entity.ts#assertLegalIncidentTransition` — data-model.md
     * D-4's transition table rejects this `(from, to)` pair. */
    notAllowed:
      'Esta transição de estado não é permitida para o incidente a partir do estado atual.',
    /** Invariant I1 — `resolutionSummary` missing when `toStatus: RESOLVED`. */
    resolutionSummaryRequired:
      'O resumo da resolução é obrigatório para marcar o incidente como resolvido.',
    /** Invariant I2 — `cancellationReason` missing when `toStatus:
     * CANCELLED`. */
    cancellationReasonRequired: 'O motivo do cancelamento é obrigatório.',
    /** `TransitionIncidentRequest.reopenReason`'s `required` when
     * reopening (`RESOLVED -> IN_PROGRESS`). */
    reopenReasonRequired: 'O motivo da reabertura é obrigatório.',
  },

  link: {
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este incidente.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',

    assetNotFound: 'Ativo não encontrado, inativo ou fora do escopo do usuário.',
    assetAlreadyLinked: 'Este ativo já está vinculado a este incidente.',
    assetLinkNotFound: 'Vínculo com ativo não encontrado.',
    assetLinkAlreadyWithdrawn: 'Este vínculo com ativo já foi desfeito.',

    processNotFound: 'Processo não encontrado, inativo ou fora do escopo do usuário.',
    processAlreadyLinked: 'Este processo já está vinculado a este incidente.',
    processLinkNotFound: 'Vínculo com processo não encontrado.',
    processLinkAlreadyWithdrawn: 'Este vínculo com processo já foi desfeito.',
  },

  /** `NotFoundDomainError`'s `entityType` label for a link resource
   * (distinct from `entityLabel` above, which names the incident itself). */
  riskLinkEntityLabel: 'Vínculo entre incidente e risco',
  assetLinkEntityLabel: 'Vínculo entre incidente e ativo',
  processLinkEntityLabel: 'Vínculo entre incidente e processo',
};

/** `LinkIncidentRiskRequestDto` (US3, operation `linkIncidentToRisk`). */
export const linkIncidentRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;

/** `LinkIncidentAssetRequestDto` (US3, operation `linkIncidentToAsset`). */
export const linkIncidentAssetFields = {
  assetId: { isUuid: 'O ativo informado é inválido.' },
} as const;

/** `LinkIncidentProcessRequestDto` (US3, operation `linkIncidentToProcess`). */
export const linkIncidentProcessFields = {
  processId: { isUuid: 'O processo informado é inválido.' },
} as const;

/** `CreateIncidentRequestDto`/`UpdateIncidentRequestDto` (US1, operations
 * `createIncident`/`updateIncident`). */
export const incidentFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  reportedOn: { isDateString: 'A data de reporte informada é inválida.' },
} as const;

/** `ListIncidentsQueryDto` (US1, `listIncidents` operation). */
export const incidentListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  search: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `TransitionIncidentRequestDto` (US1, `transitionIncident` operation). */
export const incidentTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  resolutionSummary: {
    isString: 'O resumo da resolução deve ser um texto.',
    maxLength: 'O resumo da resolução deve ter no máximo 4000 caracteres.',
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
