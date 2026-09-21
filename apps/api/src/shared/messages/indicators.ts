/**
 * 009-indicators-reports, Fase 2 (T010) — Indicator. See `findings.ts`'s
 * header for the full explanation of the modular mechanism this file
 * follows identically (CLAUDE.md §11.1: every new user-facing string lives
 * here, in pt-BR, never inline in a component or use case).
 *
 * T010's original minimal subset was just `entityLabel`, the one string
 * `IndicatorParentRecordAccessor` needs for its `NotFoundDomainError`.
 * Fase 1's own T006 (this addition) adds `IndicatorMetricKey`'s eleven
 * pt-BR labels (data-model.md §3), `IndicatorThresholdComparator`'s four
 * pt-BR labels (data-model.md §4), the threshold-breach notification body
 * (User Story 3, FR-017), and the small set of domain error messages the
 * rules already decided by this spec need (Invariant T1, research.md D-6,
 * unknown metric key). "`IndicatorDefinition` not found" needs no message
 * of its own: `entityLabel` above already produces it through
 * `NotFoundDomainError`'s own template ("Indicador {id} não foi
 * encontrado(a)."), the same convention `incidents.ts`/`problems.ts` use
 * for their own root entity. Fase 3+ use cases add their own write-path/
 * DTO messages to this same file as they are built — this catalog is not,
 * and is not meant to be, complete for the whole module yet.
 *
 * `metricKeyLabels`/`thresholdComparatorLabels` use the SAME wording as
 * `apps/web/src/lib/messages/indicators.ts`'s own
 * `INDICATOR_METRIC_KEY_LABELS`/`INDICATOR_THRESHOLD_COMPARATOR_LABELS` —
 * API and web keep separate catalogs by design (mirrors
 * `incidents.ts`/`apps/web/src/lib/messages/incidents.ts`'s own split), but
 * the same indicator must never carry two different names depending on
 * which side renders it.
 *
 * `metricKeyLabels` is typed `Record<IndicatorMetricKey, string>` (the
 * generated Prisma enum, imported type-only — the same accepted exception
 * `indicator-metric-catalog.ts`'s own header documents), not the looser
 * `Record<string, string>` F-1 warns against
 * (`docs/deferred-findings.md`): a twelfth value added to the enum without
 * a matching label here fails `tsc`, the same exhaustiveness guarantee
 * `indicator-metric-catalog.ts` already has for its own map.
 */
import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export const indicators = {
  /** `NotFoundDomainError`'s `entityType` label (mirrors
   * `incidents.entityLabel`'s own convention) — appears verbatim in
   * `problem+json`'s `detail` ("Indicador {id} não foi encontrado(a)."). */
  entityLabel: 'Indicador',

  /** The eleven values of `IndicatorMetricKey` (data-model.md §3,
   * research.md D-4) — one metric per business domain already implemented.
   * Wording mirrors `apps/web/src/lib/messages/indicators.ts`'s own
   * `INDICATOR_METRIC_KEY_LABELS`, verbatim. */
  metricKeyLabels: {
    RISK_TOTAL_BY_LEVEL: 'Riscos por nível',
    RISK_TREATMENT_OVERDUE_COUNT: 'Tratamentos de risco em atraso',
    CONTROL_INACTIVE_COUNT: 'Controles inativos',
    COMPLIANCE_PERCENTAGE: 'Percentual de conformidade',
    AUDIT_ENGAGEMENT_OPEN_COUNT: 'Engajamentos de auditoria abertos',
    FINDING_OPEN_COUNT_BY_SEVERITY: 'Achados abertos por severidade',
    ASSET_INACTIVE_COUNT: 'Ativos inativos',
    PROCESS_INACTIVE_COUNT: 'Processos inativos',
    ACTION_OVERDUE_COUNT: 'Ações em atraso',
    INCIDENT_OPEN_COUNT_BY_SEVERITY: 'Incidentes abertos por severidade',
    PROBLEM_OPEN_COUNT_BY_SEVERITY: 'Problemas abertos por severidade',
  } satisfies Record<IndicatorMetricKey, string>,

  /** The four values of `IndicatorThresholdComparator` (data-model.md §4)
   * — no equality/difference operator exists in the registry, so none is
   * translated here either. Wording mirrors
   * `apps/web/src/lib/messages/indicators.ts`'s own
   * `INDICATOR_THRESHOLD_COMPARATOR_LABELS`, verbatim. */
  thresholdComparatorLabels: {
    GTE: 'Maior ou igual',
    GT: 'Maior',
    LTE: 'Menor ou igual',
    LT: 'Menor',
  } satisfies Record<IndicatorThresholdComparator, string>,

  /** FR-017/Acceptance Scenario 1 (US3): the `NotificationService.notify`
   * `title` for the same threshold-breach event `thresholdBreachedBody`
   * below is the `body` for — `NotifyInput.title` is a required field
   * (`core/notifications/application/notification.service.ts`), and
   * spec.md's own requirement is only that the body names the indicator
   * and the value, so this is the minimal, parameterized choice for the
   * title (see this task's final report). */
  thresholdBreachedTitle: (indicatorName: string): string =>
    `Limiar de indicador rompido: ${indicatorName}`,

  /** FR-017/Acceptance Scenario 1 (US3): the notification body a
   * threshold-breach `NotificationService.notify` call sends to the
   * indicator's `ownerUserId` — names the indicator and the calculated
   * value, as a template (never string concatenation at the call site,
   * mirroring `risk.ts`'s own parameterized-message convention). */
  thresholdBreachedBody: (indicatorName: string, calculatedValue: string): string =>
    `O indicador "${indicatorName}" rompeu o limiar configurado. Valor calculado: ${calculatedValue}.`,

  /** Invariant T1 (data-model.md §1): `thresholdComparator`/
   * `thresholdValue` must be filled together, or neither — a comparator
   * without a value (or the reverse) has no evaluable meaning. Spec.md
   * does not name an FR for this invariant's own violation message; this
   * wording is the minimal choice for it (see this task's final report). */
  thresholdRequiresBothFields:
    'O comparador e o valor do limiar devem ser informados juntos, ou nenhum dos dois.',

  /** research.md D-6: creating or reading an `IndicatorMeasurement`
   * requires the caller's resolved `ScopeFilter` to be `{ kind: 'GLOBAL' }`
   * — never `UNIT`, even when the caller's units cover the whole
   * organizational tree today. FR-012/FR-014 decide the requirement;
   * neither names this refusal's own wording, so this is the minimal
   * choice for it (see this task's final report). */
  measurementRequiresGlobalScope:
    'Registrar ou consultar o histórico de um indicador exige acesso à organização inteira.',

  /** `POST /indicators/{metricKey}/measurements` (FR-011) with a
   * `metricKey` path segment outside `IndicatorMetricKey`'s closed
   * registry (data-model.md §3). Spec.md does not name an FR for this
   * message's own wording; this is the minimal choice for it (see this
   * task's final report). Reused verbatim by `CreateIndicatorDefinitionUseCase`
   * (T018) as one of the three `422` reasons
   * `contracts/indicators.openapi.yaml`'s `createIndicatorDefinition` names
   * for an unknown `metricKey` in the request body — the read path
   * (`GET .../current`, below) answers the SAME underlying fact with a
   * different status (`404`, FR-010), so it uses its own
   * `metricKeyEntityLabel`, not this string, to build that response
   * through `NotFoundDomainError`'s own template. */
  unknownMetricKey: 'A chave de métrica informada não existe no catálogo de indicadores.',

  /** `NotFoundDomainError`'s `entityType` label for
   * `GET /indicators/{metricKey}/current` (FR-010) — distinct from
   * `entityLabel` above, which names a configured `IndicatorDefinition`
   * row, not the catalog key itself. Produces "Chave de indicador {key}
   * não foi encontrado(a)." verbatim, the same template every other
   * `NotFoundDomainError` call site in this codebase already relies on. */
  metricKeyEntityLabel: 'Chave de indicador',

  /** `CreateIndicatorDefinitionUseCase` (T018, data-model.md §1): `metricKey`
   * is `UNIQUE` — at most one `IndicatorDefinition` per catalog key. `422`,
   * one of the three reasons `contracts/indicators.openapi.yaml`'s
   * `createIndicatorDefinition` names. */
  metricKeyAlreadyConfigured: 'Este indicador já possui uma definição configurada.',

  /** `CreateIndicatorDefinitionUseCase` (T018) — referential integrity on
   * `ownerUserId`, mirroring `incidents.ts#ownerNotFound`'s own wording and
   * non-disclosure shape (existence and inactive both answer identically). */
  ownerNotFound: 'Usuário responsável pelo indicador não encontrado ou inativo.',

  /** `GetIndicatorCurrentValueUseCase` (T030, FR-006): the caller holds
   * `indicator:view` (checked by `PermissionGuard` before this use case
   * ever runs) but lacks the source domain's OWN read permission for this
   * metric key (`sourcePermission`, `indicator-metric-catalog.ts`) — `403`,
   * naming the missing permission so the caller can tell this apart from
   * "you lack `indicator:view` entirely" (contracts/indicators.openapi.yaml's
   * own description for this response). Spec.md does not name an FR for
   * this message's own wording; this is the minimal choice for it (see
   * this task's final report). */
  sourcePermissionRequired: (permission: string): string =>
    `Esta operação também exige a permissão "${permission}".`,

  /** `IndicatorActionOriginAccessor` (Fase 6, T043): `IndicatorDefinition`
   * has no organizational unit of its own (research.md D-8), so
   * `Action.orgUnitId` (NOT NULL) is derived from the definition's OWN
   * `ownerUserId`'s current `primaryOrgUnitId` instead
   * (`IndicatorReferenceDataPort#findUserOrgUnitId`). This is the refusal
   * for the rare case where that owner has none — a real state
   * (`User.primaryOrgUnitId` is nullable) this accessor must refuse rather
   * than silently invent a unit for. Spec.md does not name an FR for this
   * message's own wording; this is the minimal choice for it (see this
   * task's final report). */
  ownerHasNoOrgUnitForAction:
    'Não é possível criar uma ação a partir deste indicador: o responsável pelo indicador não possui unidade organizacional definida.',
} as const;

/** `CreateIndicatorDefinitionRequestDto` (Fase 3, T031, operation
 * `createIndicatorDefinition`). `metricKey` is validated as a non-empty
 * string only here — NOT against the closed `IndicatorMetricKey` enum
 * (contrast `ListIndicatorsQueryDto`'s absence of any such field): the
 * contract deliberately answers an unknown `metricKey` at creation with
 * `422` (`unknownMetricKey` above, from the USE CASE), not `400` from the
 * `ValidationPipe` — see `CreateIndicatorDefinitionUseCase`'s own header. */
export const indicatorFields = {
  metricKey: {
    isString: 'A chave de métrica deve ser um texto.',
    length: 'A chave de métrica deve ter entre 1 e 100 caracteres.',
  },
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  ownerUserId: { isUuid: 'O usuário responsável informado é inválido.' },
  thresholdComparator: { isIn: 'O comparador de limiar informado é inválido.' },
  thresholdValue: { isNumber: 'O valor do limiar deve ser numérico.' },
  /** `UpdateIndicatorDefinitionRequestDto` (Fase 8, T068 prep, operation
   * `updateIndicatorDefinition`). */
  isActive: { isBoolean: 'O campo "ativo" deve ser um valor booleano.' },
} as const;

/** `ListIndicatorDefinitionsQueryDto` (Fase 3, T031, operation
 * `listIndicatorDefinitions`). */
export const listIndicatorsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;
