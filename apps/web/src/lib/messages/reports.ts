/**
 * PharosGRC — Gestão de Relatórios (pt-BR), 009-indicators-reports.
 *
 * T061 (2026-09-12) extends this catalog from the earlier frontend-facing scaffold (T007) to the
 * three screens `apps/web/src/app/(app)/reports/` renders: catálogo (`register`), criação
 * (`form`), execução (`run`) — plus the CSV export affordance (`run.csvExport`).
 *
 * **Per-metric labels are NOT duplicated here.** `register.metricCountLabel`/the checkbox list in
 * `ReportForm` both read `indicators.metricKeyLabels`/`indicators.bucketBadgeLabels` from
 * `lib/messages/indicators.ts` directly — the owning catalog, per this file's original header —
 * exactly as the coordinator's own instruction for this task requires ("os onze rótulos de
 * métrica vivem no catálogo de indicators.ts — reuse, não duplique").
 *
 * **Situação (ativo/inativo) never depends only on color** (CLAUDE.md §18.8, mirrors
 * `lib/messages/assets.ts`'s own `situationLabels`/`situationVariant` pair one-for-one) —
 * `StatusBadge` composes color + icon + text label by default; this catalog supplies only the
 * label and the variant, never a color-only signal.
 */
import type { IndicatorScopeApplicability } from '@/features/reports/types';
import type { StatusVariant } from '@pharos/design-system/components';

const SITUATION_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
} as const;

const SITUATION_VARIANT: Record<keyof typeof SITUATION_LABELS, StatusVariant> = {
  active: 'success',
  inactive: 'neutral',
};

export const reports = {
  entityLabel: 'relatório',
  navLabel: 'Relatórios',
  situationLabels: SITUATION_LABELS,
  situationVariant: SITUATION_VARIANT,

  /** `/reports` — the saved-report catalog (US5). */
  register: {
    pageTitle: 'Relatórios',
    pageDescription:
      'Relatórios que combinam indicadores de múltiplos domínios de GRC, dentro do seu escopo organizacional.',
    createAction: 'Novo relatório',
    loading: 'Carregando relatórios…',
    loadError: 'Não foi possível carregar os relatórios.',
    tableCaption: 'Lista de relatórios cadastrados',
    empty: {
      title: 'Nenhum relatório criado',
      description: 'Nenhum relatório foi criado ainda para a sua organização.',
      createAction: 'Novo relatório',
    },
    noResults: {
      title: 'Nenhum relatório encontrado para os filtros aplicados',
      description: 'Tente limpar os filtros para ver todos os relatórios.',
      clearAction: 'Limpar filtros',
    },
    /** `ReportRegisterSummary`'s three server-counted tiles — see that
     * component's own header for why there are exactly three, and why
     * "Inativos" is a subtraction rather than a third request. */
    summary: {
      regionLabel: 'Resumo do catálogo de relatórios',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de relatórios',
        hint: 'Todos os relatórios no seu escopo',
        linkLabel: 'Ver todos os relatórios',
      },
      active: {
        label: 'Relatórios ativos',
        hint: 'Em uso corrente',
        linkLabel: 'Ver relatórios ativos',
      },
      inactive: {
        label: 'Relatórios inativos',
        hint: 'Desativados — preservados, nunca excluídos',
        linkLabel: 'Ver relatórios inativos',
      },
    },
    columns: {
      code: 'Código',
      name: 'Nome',
      description: 'Descrição',
      metrics: 'Métricas',
      situation: 'Situação',
      createdBy: 'Criado por',
      createdAt: 'Criado em',
      actions: 'Ações',
      /** Defensive only — `metricKeys` requires at least one entry at creation
       * (`form.validation.metricKeys.required`) and this contract has no edit
       * operation that could empty it afterwards, so this never renders in
       * practice. Kept so the metrics cell degrades the same quiet way every
       * other "no value yet" cell in this product does, rather than an empty
       * cell or a raw `0`. */
      notSet: 'Nenhum indicador',
    },
    metricCountLabel: (count: number): string =>
      count === 1 ? '1 indicador' : `${count} indicadores`,
    /** `PopoverTitle` inside the "Métricas" cell's disclosure — the per-metric pt-BR names
     * themselves come from `indicators.metricKeyLabels` (this file's own header: owning catalog,
     * reused, never duplicated). */
    metricsPopoverTitle: 'Indicadores incluídos',
    runAction: 'Executar',
    filters: {
      regionLabel: 'Filtros dos relatórios',
      groupLabel: 'Filtros',
      situationLabel: 'Situação',
      situationAll: 'Todas as situações',
      situationActive: 'Ativo',
      situationInactive: 'Inativo',
    },
    activeFilters: {
      regionLabel: 'Filtros ativos',
      valueChip: (fieldLabel: string, valueLabel: string): string => `${fieldLabel}: ${valueLabel}`,
      removeLabel: (chipText: string): string => `Remover filtro: ${chipText}`,
    },
    /** `ResultsToolbar`'s left-aligned count (CLAUDE.md §18.12 family convergence) — this
     * catalog has no sort control (`listReportDefinitions` declares no `sort` parameter,
     * `report-register-columns.tsx`'s own header comment), so the toolbar carries only the
     * count, never an ordering control that the server would reject. */
    results: {
      count: (total: number): string =>
        total === 1 ? '1 relatório' : `${total.toLocaleString('pt-BR')} relatórios`,
      countLoading: 'Carregando resultados…',
    },
    /** Client-side gate for `report:create` — an advisory courtesy only (CLAUDE.md, `lib/permissions.ts`'s own module doc comment): the server's `PermissionGuard` re-checks unconditionally regardless of this screen ever rendering. */
    createForbidden: {
      title: 'Sem permissão para criar relatórios',
      description:
        'Você tem acesso à lista de relatórios, mas não tem a permissão necessária para criar um novo. Se isso não for esperado, procure um administrador.',
      backAction: 'Voltar para Relatórios',
    },
  },

  /** `POST /reports` — the creation form (US5). */
  form: {
    createHeading: 'Novo relatório',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'Nome e descrição do relatório, visíveis a qualquer pessoa com acesso.',
      },
      metrics: {
        title: 'Indicadores incluídos',
        description:
          'Selecione ao menos um indicador. Um item sem a permissão de origem necessária aparece, na execução, como indisponível — nunca como um valor zerado.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: { label: 'Descrição' },
      metricKeys: {
        label: 'Indicadores',
        selectedCount: (count: number): string =>
          count === 1 ? '1 indicador selecionado' : `${count} indicadores selecionados`,
      },
    },
    validation: {
      name: { required: 'Informe um nome para o relatório.' },
      description: { required: 'Informe uma descrição para o relatório.' },
      metricKeys: { required: 'Selecione ao menos um indicador.' },
    },
    actions: {
      saveAndCreate: 'Criar relatório',
      creating: 'Criando…',
      cancel: 'Cancelar',
    },
    createSuccess: (name: string): string => `Relatório "${name}" criado.`,
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    genericError: 'Não foi possível criar o relatório agora. Tente novamente.',
  },

  /** `GET /reports/{reportId}/run` — the on-demand execution view (US5, FR-025 to FR-028). */
  run: {
    triggerAction: 'Executar',
    dialogDescriptionFallback: 'Valor atual de cada indicador incluído neste relatório.',
    loading: 'Executando relatório…',
    loadError: 'Não foi possível executar este relatório agora.',
    computedAtLabel: (formatted: string): string => `Executado em ${formatted}`,
    /** FR-026/SC-006 — a per-item permission gap never fails the whole run; this is that one item's `MetricCard` copy, distinct in wording from a genuine load failure (never a bare zero, CLAUDE.md §18.11). */
    itemUnavailable: {
      label: 'Sem permissão para ver este item',
      hint: 'Este indicador exige uma permissão adicional do domínio de origem.',
    },
    /**
     * `MetricCard.orgUnitLabel`, PER ITEM (S-07, `A4-F01`): a run mixes metrics of different
     * `scopeApplicability` (e.g. `RISK_TOTAL_BY_LEVEL`, `ORGANIZATIONAL_UNIT`, alongside
     * `COMPLIANCE_PERCENTAGE`, `ORGANIZATION_WIDE`), so there is no single scope label correct for
     * the whole run — `ReportRunDialog` calls this once per `ReportRunItem`, never once for the
     * dialog as a whole. An `ORGANIZATION_WIDE` item is always "Organização inteira" no matter the
     * caller's own scope; an `ORGANIZATIONAL_UNIT` item falls back to the caller's own
     * `EffectiveScope.global`, mirroring `indicators.register.scopeLabel`'s own rule.
     */
    scopeLabel: (scopeApplicability: IndicatorScopeApplicability, global: boolean): string =>
      scopeApplicability === 'ORGANIZATION_WIDE' || global
        ? 'Escopo: Organização inteira'
        : 'Escopo: Unidades organizacionais do seu escopo',
    close: 'Fechar',
    csvExport: {
      action: 'Exportar CSV',
      accessibleLabel: (reportName: string): string => `Exportar "${reportName}" em CSV`,
    },
  },
} as const;
