/**
 * 009-indicators-reports, Fase 1 (T006) + Fase 7 (T051/T052) — Report. See
 * `findings.ts`'s header for the full explanation of the modular mechanism
 * this file follows identically (CLAUDE.md §11.1: every new user-facing
 * string lives here, in pt-BR, never inline in a component or use case).
 *
 * T006's original minimal subset was just `entityLabel`, the one string a
 * `NotFoundDomainError` for `ReportDefinition` (data-model.md §1, FR-022)
 * needs. Fase 7's own T051/T052 (this addition) adds
 * `CreateReportDefinitionUseCase`'s `metricKeys` validation messages
 * (data-model.md §1's "não vazio", FR-022's closed `IndicatorMetricKey`
 * membership). Spec.md does not name an FR for either message's own
 * wording; these are the minimal choice for them (see this task's final
 * report). CSV export (T053) needs no message of its own: every string it
 * emits — column headers, `true`/`false`, enum values — is either a fixed
 * technical identifier (contracts/reports.openapi.yaml's own header names
 * the header row verbatim) or reuses `indicators.metricKeyLabels`/
 * `IndicatorMetricScopeApplicability`'s own enum values, never new pt-BR
 * prose.
 */
export const reports = {
  /** `NotFoundDomainError`'s `entityType` label (mirrors
   * `indicators.entityLabel`'s own convention) — appears verbatim in
   * `problem+json`'s `detail` ("Relatório {id} não foi encontrado(a)."). */
  entityLabel: 'Relatório',

  /** `CreateReportDefinitionUseCase` (T051, data-model.md §1): `metricKeys`
   * must be non-empty — a report referencing zero indicators has nothing to
   * run or export. */
  metricKeysEmpty: 'A lista de métricas do relatório deve conter ao menos uma chave.',

  /** `CreateReportDefinitionUseCase` (T051, FR-022): every element of
   * `metricKeys` must belong to the closed `IndicatorMetricKey` catalog.
   * Distinct wording from `indicators.unknownMetricKey` (that string names
   * "the metric key" singular, for `IndicatorDefinition`'s own one-key
   * field) because this message names the plural `metricKeys` field a
   * `ReportDefinition` actually carries. */
  unknownMetricKey: (metricKey: string): string =>
    `A chave de métrica "${metricKey}" não existe no catálogo de indicadores.`,
} as const;

/** `CreateReportDefinitionRequestDto`/`ListReportDefinitionsQueryDto`
 * (Fase 7, T054, operations `createReportDefinition`/
 * `listReportDefinitions`). Mirrors `indicatorFields`/`listIndicatorsQuery`'s
 * own convention (`shared/messages/indicators.ts`).
 *
 * `metricKeys` IS validated against the closed `IndicatorMetricKey` enum at
 * this DTO level (`@IsIn(..., { each: true })`), unlike
 * `indicatorFields.metricKey` — `contracts/reports.openapi.yaml`'s own
 * header decides this differently for `ReportDefinition`: "an unknown value
 * is rejected as malformed (400), not as a domain error, because it fails
 * schema validation before any business rule runs." `metricKeysEmpty`/
 * `unknownMetricKey` above remain as `CreateReportDefinitionUseCase`'s own
 * defense-in-depth check (that use case's own header), reached only by a
 * caller bypassing this DTO entirely (e.g. a direct application-layer
 * call, as this feature's own integration tests make). */
export const reportFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  metricKeys: {
    isArray: 'A lista de métricas deve ser um vetor.',
    arrayNotEmpty: 'A lista de métricas do relatório deve conter ao menos uma chave.',
    arrayUnique: 'A lista de métricas não pode repetir a mesma chave.',
    isIn: 'A lista de métricas contém uma chave que não existe no catálogo de indicadores.',
  },
  /** `UpdateReportDefinitionRequestDto` (Fase 8, T068 prep, operation
   * `updateReportDefinition`). */
  isActive: { isBoolean: 'O campo "ativo" deve ser um valor booleano.' },
} as const;

/** `ListReportDefinitionsQueryDto` (Fase 7, T054, operation
 * `listReportDefinitions`). */
export const listReportsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

/** `RunReportQueryDto` (Fase 7, T054, operation `runReport`) —
 * `contracts/reports.openapi.yaml`'s `format` query parameter, `json`
 * (default) or `csv`. */
export const runReportQuery = {
  format: { isIn: 'O formato solicitado é inválido. Use "json" ou "csv".' },
} as const;
