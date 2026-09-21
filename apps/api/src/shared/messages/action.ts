/**
 * T003/002-shared-grc-foundation — Action (US2). See `evidence.ts`'s header
 * for the full explanation of the modular mechanism and the enum-label-map
 * convention this file follows identically.
 *
 * `originTypeLabels` intentionally has exactly the members
 * `ActionOriginType` currently declares (`RISK_TREATMENT`, `FINDING`,
 * `CONTROL_ASSESSMENT` — the last added by 003-controls-management, T004)
 * — a future origin (`INCIDENT`, `COMPLIANCE_GAP`, ...) arrives with its
 * own module and adds its own label here at that time (`satisfies
 * Record<...>` makes the omission a compile error the moment the enum
 * grows, so this is enforced, not merely intended).
 *
 * Business-rule and DTO validation strings below were added at T051-T053,
 * the point they are actually needed — not invented ahead of the use
 * cases/DTOs that use them, matching `evidence.ts`'s own documented
 * incremental history.
 */
import type { ActionOriginType, ActionStatus } from '@prisma/client';

export const action = {
  originTypeLabels: {
    RISK_TREATMENT: 'Tratamento de risco',
    FINDING: 'Achado',
    // 003-controls-management, data-model.md §7/FR-027, research.md D-5 —
    // the origin is the verification that failed, not the generic
    // `CONTROL` entity itself.
    CONTROL_ASSESSMENT: 'Verificação de controle',
    // 008-incidents-problems — the compile-time proof this file's own
    // header describes: the enum grew, and this is the second time (see
    // git history) an omission here would have been a type error, not a
    // runtime gap (F-1, docs/deferred-findings.md).
    INCIDENT: 'Incidente',
    PROBLEM: 'Problema',
    // 009-indicators-reports, Fase 6 (T043) — the same compile-time proof:
    // the enum grew again, and this is a type error, not a runtime gap.
    INDICATOR: 'Indicador',
  } satisfies Record<ActionOriginType, string>,

  statusLabels: {
    OPEN: 'Aberta',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  } satisfies Record<ActionStatus, string>,

  /** `NotFoundDomainError`'s `entityType` label (FR-032, SC-005) — appears
   * verbatim in `problem+json`'s `detail` ("Ação {id} não foi
   * encontrado(a)."). */
  entityLabel: 'Ação',

  /** FR-004/referential integrity on `responsibleUserId`. */
  responsibleNotFound: 'Usuário responsável pela ação não encontrado ou inativo.',
  /** Request-shape: `PATCH` body with no fields to change. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  /** FR-031: the origin record referenced by `originType`/`originId` does
   * not exist, exists but is outside the caller's organizational scope, or
   * the caller lacks edit permission on it — the three are deliberately
   * indistinguishable (SC-005), so this message is used with
   * `NotFoundDomainError` and never discloses which case applies. */
  originNotFound: 'Origem não encontrada.',

  transition: {
    /** `action.entity.ts#assertLegalActionTransition` — data-model.md §4's
     * transition table rejects this `(from, to)` pair. */
    notAllowed: 'Esta transição de estado não é permitida para a ação a partir do estado atual.',
    /** Invariant A2 — reopening (`COMPLETED -> OPEN`) requires a reason. */
    reopenReasonRequired: 'Informe o motivo da reabertura.',
  },
} as const;

/** `CreateActionRequestDto`/`UpdateActionRequestDto` (T053). */
export const actionFields = {
  originType: { isIn: 'O tipo de origem informado é inválido.' },
  originId: { isUuid: 'O identificador de origem informado é inválido.' },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: { maxLength: 'A descrição deve ter no máximo 4000 caracteres.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  dueOn: { isDateString: 'O prazo informado é inválido.' },
} as const;

/** `TransitionActionRequestDto` (T053). */
export const actionTransitionFields = {
  to: { isIn: 'O estado de destino informado é inválido.' },
  reason: { maxLength: 'O motivo deve ter no máximo 1000 caracteres.' },
} as const;

/** `ListActionQueryDto` (T053). */
export const actionListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  originType: { isIn: 'O tipo de origem informado é inválido.' },
  originId: { isUuid: 'O identificador de origem informado é inválido.' },
  overdue: { isBoolean: 'O filtro de atraso informado é inválido.' },
  dueBefore: { isDateString: 'A data informada é inválida.' },
} as const;

/** `ListActionAuditEventsQueryDto` — `GET /actions/{actionId}/audit-events`
 * (`contracts/grc-foundation.openapi.yaml`'s `listActionAuditEvents`
 * operation). Mirrors `risk.ts`'s `riskAuditEventsQuery` field-for-field —
 * same query shape, same precedent (`modules/risk/presentation/dto/
 * list-risk-audit-events-query.dto.ts`). */
export const actionAuditEventsQuery = {
  action: { maxLength: 'A ação informada deve ter no máximo 100 caracteres.' },
  actorUserId: { isUuid: 'O identificador de usuário informado é inválido.' },
  occurredFrom: { isDateString: 'A data inicial informada é inválida.' },
  occurredTo: { isDateString: 'A data final informada é inválida.' },
} as const;
