/**
 * PharosGRC — Gestão de Indicadores (pt-BR), 009-indicators-reports.
 *
 * T060 (2026-09-12) extends this catalog from the earlier frontend-facing scaffold (T007/T012) to
 * the three screens `apps/web/src/app/(app)/indicators/` renders: catalog, current value and
 * history. `register` carries the catalog screen's own copy; `detail`/`history` are new.
 *
 * `INDICATOR_METRIC_KEY_LABELS`/`INDICATOR_THRESHOLD_COMPARATOR_LABELS` are typed as exhaustive
 * `Record<IndicatorMetricKey, string>`/`Record<IndicatorThresholdComparator, string>` (T012): both
 * unions are re-exported from the GENERATED `@pharos/api-types` `Indicators` namespace via
 * `features/indicators/types.ts`, the same way `incidents.ts`'s own `INCIDENT_STATUS_LABELS` is
 * typed against a real generated union. This is a compile-time guarantee, not a runtime one — a
 * twelfth `IndicatorMetricKey` value added to the contract without a label here fails `tsc`,
 * exactly like `incidents.ts`'s own header names as the pattern (F-1).
 *
 * `bucketBadgeLabels` reuses `risks.riskLevelLabels`' own four words ("Baixo"/"Médio"/"Alto"/
 * "Crítico") rather than re-declaring them — `MetricCard`'s `byBucket` shape asks every caller to
 * map its own domain enum onto `RiskLevel` (`FindingSeverity`/`IncidentSeverity`/`ProblemSeverity`
 * all share that exact four-value set, `apps/api/prisma/schema.prisma`), and the word for each
 * level is the same word regardless of which domain is being counted. The `accessibleLabel`
 * wording is this module's OWN, deliberately not `risks.riskLevelBadge.accessibleLabel`'s "Nível de
 * risco: {x}" — an incident/finding/problem severity bucket is not a risk level, and reusing that
 * exact phrase would misname it for three of the four `BY_BUCKET` keys.
 */
import { risks } from './risks';
import { shell } from './shell';

import type { IndicatorDomain } from '@/features/indicators/overview/indicator-overview-model';
import type {
  IndicatorMetricKey,
  IndicatorScopeApplicability,
  IndicatorThresholdComparator,
} from '@/features/indicators/types';
import type { RiskLevel, RiskLevelBadgeLabels } from '@pharos/design-system/components';

/**
 * The eleven values of `IndicatorMetricKey` (data-model.md §3, research.md D-4) — one metric per
 * business domain already implemented (Risco, Controle, Conformidade, Auditoria, Achado, Ativo,
 * Processo, Ação, Incidente, Problema; Auditoria/Achado counts as two). Labels name what the
 * metric counts, not the raw enum shape — mirrors the plain-language phrasing research.md D-4's
 * own table uses for each row.
 */
const INDICATOR_METRIC_KEY_LABELS: Record<IndicatorMetricKey, string> = {
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
};

/**
 * The four values of `IndicatorThresholdComparator` (data-model.md §4) — no equality/difference
 * operator exists in the registry, so none is translated here either. Wording mirrors the
 * data-model's own plain-language description of each ("maior-ou-igual", "maior", "menor-ou-igual",
 * "menor").
 */
const INDICATOR_THRESHOLD_COMPARATOR_LABELS: Record<IndicatorThresholdComparator, string> = {
  GTE: 'Maior ou igual',
  GT: 'Maior',
  LTE: 'Menor ou igual',
  LT: 'Menor',
};

/** `MetricCard`'s `badgeLabels` prop (D-10) for every `BY_BUCKET` metric — see this file's header for why the wording is its own, not `risks.riskLevelBadge`'s. */
const bucketBadgeLabels: RiskLevelBadgeLabels = {
  levelName: (level) => risks.riskLevelLabels[level],
  // `MetricCard` never passes a `basis` to `RiskLevelBadge`, so this is never actually invoked —
  // kept only because `RiskLevelBadgeLabels` requires it.
  basisPrefixedLevel: (_basis, levelLabel) => levelLabel,
  accessibleLabel: (label) => `Nível: ${label}`,
};

/**
 * `RiskLevel`'s FEMININE agreement ("severidade Alta", never "severidade
 * Alto") — used only inside a bucket link's own accessible name for the
 * three severity-based `BY_BUCKET` keys (Incidente/Problema/Achado), never
 * for `RISK_TOTAL_BY_LEVEL`'s own "nível" wording (masculine,
 * `risks.riskLevelLabels`, unchanged). Two forms of the same four words,
 * not a duplicate vocabulary: `RiskLevelBadge`'s VISIBLE label stays the
 * masculine form everywhere (data-model.md's own `RiskLevel` enum has one
 * canonical rendering, `bucketBadgeLabels.levelName` above) — this map only
 * feeds grammatically-correct SCREEN-READER text for a link whose own
 * sentence names "severidade", not a second visible badge vocabulary.
 */
const SEVERITY_LEVEL_LABELS_FEMININE: Record<RiskLevel, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

export const indicators = {
  entityLabel: 'indicador',
  navLabel: 'Indicadores',
  metricKeyLabels: INDICATOR_METRIC_KEY_LABELS,
  thresholdComparatorLabels: INDICATOR_THRESHOLD_COMPARATOR_LABELS,
  bucketBadgeLabels,
  severityLevelLabelsFeminine: SEVERITY_LEVEL_LABELS_FEMININE,

  register: {
    pageTitle: 'Indicadores',
    pageDescription: 'Métricas de GRC da plataforma, agrupadas por domínio.',
    /** Per-card `MetricCard` `status: 'unavailable'` copy — FR-006's second permission gate, missing (a report item the caller cannot read into, applied here to a single metric's current-value card). Never a bare zero (CLAUDE.md §18.11). */
    sourcePermissionMissing: {
      label: 'Sem permissão para ver este indicador',
      hint: 'Esta métrica exige uma permissão adicional do domínio de origem.',
    },
    /** A genuine load failure (network, 5xx) — kept visually distinct in wording from `sourcePermissionMissing` above even though both render through `MetricCard`'s same `unavailable` treatment (never a bare zero either way). */
    loadFailed: {
      label: 'Erro ao carregar',
      hint: 'Não foi possível calcular este indicador agora.',
    },
    /** `SINGLE_VALUE` metric whose source has no data yet (`IndicatorCurrentValue.value === null` with `shape === 'SINGLE_VALUE'` — `IndicatorCalculationService`'s own documented edge case for `COMPLIANCE_PERCENTAGE`). Never rendered as `0` (spec.md's own "nunca 0 nem 100" rule) — a real, distinct `unavailable` reason, not a permission gate. */
    noDataYet: {
      label: 'Sem dados calculados ainda',
      hint: 'Este indicador ainda não possui dados suficientes na origem para um valor.',
    },
    /**
     * `MetricCard.orgUnitLabel` — the applicable scope. `scopeApplicability` is the metric's OWN
     * business rule (S-07, `A4-F01`): a metric marked `ORGANIZATION_WIDE` (`COMPLIANCE_PERCENTAGE`
     * today) is always computed for the whole organization, regardless of the caller's own scope,
     * so it is labeled "Organização inteira" unconditionally. Only an `ORGANIZATIONAL_UNIT` metric
     * falls back to the coarse "whole org vs. your own scope" wording `EffectiveScope.global`
     * already gives the client — never invented org-unit names the API response does not carry.
     *
     * The non-global branch is deliberately plural/count-free ("Unidades organizacionais do seu
     * escopo"), never "Sua unidade organizacional" (singular): `EffectiveScope.orgUnitIds`
     * (`lib/auth-types.ts`) is an ARRAY — `GET /auth/session` sends `Array.from(scope.unitIds)`
     * verbatim (`apps/api/.../auth.controller.ts`), and that `unitIds` set is already expanded to
     * include descendants (FR-025b, `apps/api/src/shared/persistence/scope-filter.ts`'s own doc
     * comment) and can come from more than one `OrgScopeGrant` row
     * (`ScopeResolverService.computeScope`). A caller with two direct grants, or one grant whose
     * unit has descendants, genuinely has more than one org-unit id in scope — "sua unidade"
     * (singular) would be a false claim for that caller. This card has no unit NAMES or COUNT to
     * show (only the boolean `global`), so the wording names the category ("unidades
     * organizacionais do seu escopo") rather than asserting a cardinality it cannot back up —
     * true whether the caller's scope resolves to one unit or several.
     */
    scopeLabel: (scopeApplicability: IndicatorScopeApplicability, global: boolean): string =>
      scopeApplicability === 'ORGANIZATION_WIDE' || global
        ? 'Escopo: Organização inteira'
        : 'Escopo: Unidades organizacionais do seu escopo',
    /** `MetricCard.updatedAtLabel`. */
    updatedAtLabel: (formatted: string): string => `Atualizado em ${formatted}`,
    viewDetailAction: (metricLabel: string): string => `Ver detalhes de ${metricLabel}`,
  },

  detail: {
    loading: 'Carregando indicador…',
    loadError: 'Não foi possível carregar este indicador.',
    /** FR-006's second permission gate, at the scale of the whole detail page rather than one card (T060's catalog renders many cards side by side; the detail page renders exactly one). */
    forbidden: {
      title: 'Sem permissão para ver este indicador',
      detail:
        'Você tem acesso a Indicadores, mas não tem a permissão do domínio de origem exigida por esta métrica específica. Se isso não for esperado, procure um administrador.',
    },
    sections: {
      overview: 'Visão geral',
      history: 'Histórico',
    },
    noDefinition: 'Este indicador ainda não possui uma definição configurada.',
    definitionCode: (code: string): string => `Código: ${code}`,
    definitionOwner: (fullName: string): string => `Responsável: ${fullName}`,
    definitionThreshold: (comparatorLabel: string, value: number): string =>
      `Limiar configurado: ${comparatorLabel.toLowerCase()} ${value.toLocaleString('pt-BR')}`,
    definitionNoThreshold: 'Nenhum limiar configurado para este indicador.',
  },

  history: {
    sectionDescription:
      'Série histórica de medições registradas manualmente para este indicador, para toda a organização.',
    /** research.md D-6 — the caller's resolved scope is not `GLOBAL`. Rendered as an explained, expected state (CLAUDE.md §18.11), never as an error and never simply hidden — the capability exists, it is just outside the caller's own scope. */
    scopeRestricted: {
      title: 'Histórico disponível apenas para escopo organizacional completo',
      description:
        'Registrar e consultar o histórico deste indicador exige acesso à organização inteira. Sua conta está limitada a uma unidade organizacional.',
    },
    loading: 'Carregando histórico…',
    loadError: 'Não foi possível carregar o histórico deste indicador.',
    empty: {
      title: 'Nenhuma medição registrada',
      description:
        'Registre a primeira medição para começar a acompanhar este indicador ao longo do tempo.',
    },
    tableCaption: (metricLabel: string): string => `Histórico de medições — ${metricLabel}`,
    chartTableCaption: (metricLabel: string): string => `Série histórica — ${metricLabel}`,
    dateColumnLabel: 'Calculado em',
    chartEmptyState: 'Nenhum ponto histórico para exibir no gráfico.',
    columns: {
      computedAt: 'Calculado em',
      value: 'Valor',
      breached: 'Rompimento de limiar',
      computedBy: 'Registrado por',
    },
    latestMeasurementLabel: (formatted: string): string => `Última medição (${formatted}):`,
    breachedLabel: 'Limiar rompido',
    notBreachedLabel: 'Dentro do limiar',
    thresholdNotConfiguredNote:
      'Este indicador não possui limiar configurado — nenhuma medição pode romper um limiar inexistente.',
    registerMeasurementAction: 'Registrar medição agora',
    registerMeasurementSuccess: (metricLabel: string): string =>
      `Medição de "${metricLabel}" registrada.`,
    registerMeasurementError: 'Não foi possível registrar a medição agora.',
  },

  /**
   * indicators-round (S1 ownership, coordinator PLAN.md §2/§4) — the
   * redesigned `/indicators` first screen: an executive context band,
   * search + domain filter, and the two shape-based sections ("Composição
   * por nível e severidade" for the four `BY_BUCKET` keys, "Contagens e
   * percentuais" for the seven `SINGLE_VALUE` keys). Distinct from
   * `register` above (the PREVIOUS flat 11-card grid this replaces) —
   * `register` is kept untouched because `metric-card-value.ts` and
   * `features/reports/report-metric-card-value.ts` both still read
   * `register.noDataYet`/`register.scopeLabel`/etc. for the still-live
   * detail page and the Relatórios feature (CLAUDE.md §13.8 — reuse, don't
   * duplicate — is why THIS block introduces its own, shorter "Sem dados
   * calculados" for the overview card rather than importing `register
   * .noDataYet.label`, whose "ainda" wording and two-line
   * label/hint shape were built for a different, more spacious card).
   */
  overview: {
    band: {
      /** Every one of the 11 catalog keys was computed for this caller. */
      countAll: (total: number): string => `${total} indicadores`,
      /** At least one key was omitted by `GET /dashboard/summary` because the caller lacks that key's own source-domain permission (FR-006's second gate) — never rendered as if those keys simply do not exist. */
      countPartial: (available: number, total: number, missing: number): string =>
        `${available} de ${total} disponíveis — ${missing} ${missing === 1 ? 'exige' : 'exigem'} permissão do módulo de origem`,
      scopeGlobal: 'Organização inteira',
      /**
       * Never "Sua unidade organizacional" (singular): `useAuth().scope.orgUnitIds`
       * (`EffectiveScope`, `lib/auth-types.ts`) is an array, sent verbatim from the server's own
       * `Array.from(scope.unitIds)` (`apps/api/.../auth.controller.ts`), and that `unitIds` set is
       * already expanded to include descendants (FR-025b) and can be built from more than one
       * `OrgScopeGrant` row (`ScopeResolverService.computeScope`) — a caller can genuinely have
       * several org-unit ids in scope, at which point "your unit" (singular) is a false claim. The
       * band has no unit names or count to show, only the boolean `global`, so this names the
       * category rather than asserting a cardinality it cannot back up — true for one unit or many.
       * Same fix, same reasoning as `register.scopeLabel`'s own doc comment above (the older,
       * still-live per-card label the detail page and Relatórios both read).
       */
      scopeUnit: 'Unidades organizacionais do seu escopo',
      scopePrefix: (scope: string): string => `Escopo: ${scope}`,
      /** `fetchedAt` formatted to the minute (HH:MM) — every key on this screen is computed live, at request time (`s1-backend-domain.md` Q's own "Extra" finding), so one shared timestamp for the whole page is honest; a per-card one would only repeat it eleven times. */
      calculatedAt: (time: string): string => `Calculados às ${time}`,
      refreshAction: 'Atualizar',
      /** `role="status"`, screen-reader only — the button's own icon spin already carries the sighted signal. */
      refreshing: 'Atualizando indicadores…',
      /** `summary.breakdowns.indicators.monitored === 0` — no `IndicatorDefinition` is active yet, so there is nothing to report a breach against (never "0 com limite configurado · 0 rompido", which would wrongly imply monitoring is happening and finding nothing). */
      monitoringNone: 'Nenhum indicador com limite configurado',
      monitoringSummary: (monitored: number, breached: number): string =>
        `${monitored} com limite configurado · ${breached} com limite rompido na última medição`,
    },

    /** One business domain caption per `IndicatorDomain` (PLAN.md §4) — reuses `shell.navigation.modules`' own wording verbatim for the nine domains that already have a sidebar entry, so this screen's domain caption is never one word for a module and another on its own sidebar row. `FINDING` has no sidebar entry (`Achado` is a sub-resource of Auditoria, not a top-level module — `navigation-registry.ts`'s own header) and gets this catalog's own word, matching the "Achados" sub-label `dashboard.ts`'s `modules.audits.openFindings` already uses for the same concept. */
    domainLabels: {
      RISK: shell.navigation.modules.risks,
      ACTION: shell.navigation.modules.myActions,
      PROBLEM: shell.navigation.modules.problems,
      INCIDENT: shell.navigation.modules.incidents,
      CONTROL: shell.navigation.modules.controls,
      ASSET: shell.navigation.modules.assets,
      PROCESS: shell.navigation.modules.processes,
      COMPLIANCE: shell.navigation.modules.compliance,
      AUDIT: shell.navigation.modules.audits,
      FINDING: 'Achados',
    } satisfies Record<IndicatorDomain, string>,

    filters: {
      regionLabel: 'Filtros de indicadores',
      searchLabel: 'Buscar indicadores',
      searchPlaceholder: 'Buscar por nome…',
      domainGroupLabel: 'Domínio',
      domainAll: (total: number): string => `Todos (${total})`,
      domainOption: (domainLabel: string, count: number): string => `${domainLabel} (${count})`,
      /** Accessible names for the domain pill row's own scroll-affordance chevrons — the same restrained "only when actually clipped" pattern `common.entityTabs.scrollBack`/`scrollForward` already establishes for `EntityTabs`, worded for this row instead of a record's sections. */
      scrollBack: 'Rolar filtros de domínio para a esquerda',
      scrollForward: 'Rolar filtros de domínio para a direita',
    },

    sections: {
      distributionTitle: 'Composição por nível e severidade',
      singleValueTitle: 'Contagens e percentuais',
    },

    card: {
      /** Sits BESIDE the big total number (value-size, same visual weight as a `IndicatorSingleValueCard`'s own number) — never a template sentence, so the number keeps its own typographic hierarchy. */
      totalCaption: 'Total',
      legendLabel: (metricLabel: string): string => `Distribuição de ${metricLabel}`,
      /** `RISK_TOTAL_BY_LEVEL`'s own bucket wording — "nível" (masculine), matching the platform's established risk-level vocabulary (`risks.riskLevelLabels`). */
      bucketLinkAccessibleLabelByLevel: (count: number, levelLabel: string): string =>
        `${count.toLocaleString('pt-BR')} riscos de nível ${levelLabel} — ver registros`,
      /** Every other `BY_BUCKET` key's own bucket wording — "severidade" (feminine: Baixa/Média/Alta/Crítica, never the masculine risk-level form) plus the domain's own plural noun (`domainLabels`, already plural — "incidentes"/"problemas"/"achados"). */
      bucketLinkAccessibleLabelBySeverity: (
        count: number,
        domainNoun: string,
        levelLabel: string,
      ): string =>
        `${count.toLocaleString('pt-BR')} ${domainNoun} de severidade ${levelLabel} — ver registros`,
      /** `comparatorSymbol` is a plain mathematical glyph (≥ > ≤ <), not translated text — supplied by the component, never this catalog (CLAUDE.md §11.1 governs user-facing STRINGS, not universal symbols). */
      thresholdLabel: (comparatorSymbol: string, value: number): string =>
        `Limite: ${comparatorSymbol} ${value.toLocaleString('pt-BR')}`,
      viewRecordsAction: 'Ver registros',
      viewRecordsAccessibleLabel: (metricLabel: string): string =>
        `Ver registros de ${metricLabel}`,
      /** The one per-card scope exception the redesign keeps — see `IndicatorSingleValueCard`'s own header for exactly when this is shown. */
      scopeNoteOrganizationWide: 'Este indicador é sempre calculado para a organização inteira.',
    },

    states: {
      requiresPermission: (moduleLabel: string): string => `Requer permissão de ${moduleLabel}`,
      requiresPermissionHint:
        'Você não tem a permissão do domínio de origem para ver este indicador.',
      /** Shorter than `register.noDataYet.label` on purpose — see this block's own header. */
      noData: 'Sem dados calculados',
      loadingLabel: 'Carregando indicadores…',
      summaryErrorTitle: 'Não foi possível carregar os indicadores',
      summaryErrorMessage: 'Tente novamente em instantes.',
      emptyFilteredTitle: 'Nenhum indicador encontrado',
      emptyFilteredDescription:
        'Ajuste a busca ou o filtro de domínio para ver outros indicadores.',
      definitionsUnavailableNote:
        'Não foi possível carregar os limites configurados agora — os valores acima continuam corretos.',
    },
  },
} as const;
