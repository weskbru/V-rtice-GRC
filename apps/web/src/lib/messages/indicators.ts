import { risks } from './risks';
import { shell } from './shell';

import type { IndicatorDomain } from '@/features/indicators/overview/indicator-overview-model';
import type {
  IndicatorMetricKey,
  IndicatorScopeApplicability,
  IndicatorThresholdComparator,
} from '@/features/indicators/types';
import type { RiskLevel, RiskLevelBadgeLabels } from '@pharos/design-system/components';

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

const INDICATOR_THRESHOLD_COMPARATOR_LABELS: Record<IndicatorThresholdComparator, string> = {
  GTE: 'Maior ou igual',
  GT: 'Maior',
  LTE: 'Menor ou igual',
  LT: 'Menor',
};

const bucketBadgeLabels: RiskLevelBadgeLabels = {
  levelName: (level) => risks.riskLevelLabels[level],
  basisPrefixedLevel: (_basis, levelLabel) => levelLabel,
  accessibleLabel: (label) => `Nível: ${label}`,
};

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
    sourcePermissionMissing: {
      label: 'Sem permissão para ver este indicador',
      hint: 'Esta métrica exige uma permissão adicional do domínio de origem.',
    },
    loadFailed: {
      label: 'Erro ao carregar',
      hint: 'Não foi possível calcular este indicador agora.',
    },
    noDataYet: {
      label: 'Sem dados calculados ainda',
      hint: 'Este indicador ainda não possui dados suficientes na origem para um valor.',
    },
    scopeLabel: (scopeApplicability: IndicatorScopeApplicability, global: boolean): string =>
      scopeApplicability === 'ORGANIZATION_WIDE' || global
        ? 'Escopo: Organização inteira'
        : 'Escopo: Unidades organizacionais do seu escopo',
    updatedAtLabel: (formatted: string): string => `Atualizado em ${formatted}`,
    viewDetailAction: (metricLabel: string): string => `Ver detalhes de ${metricLabel}`,
  },

  detail: {
    loading: 'Carregando indicador…',
    loadError: 'Não foi possível carregar este indicador.',
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

  overview: {
    band: {
      countAll: (total: number): string => `${total} indicadores`,
      countPartial: (available: number, total: number, missing: number): string =>
        `${available} de ${total} disponíveis — ${missing} ${missing === 1 ? 'exige' : 'exigem'} permissão do módulo de origem`,
      scopeGlobal: 'Organização inteira',
      scopeUnit: 'Unidades organizacionais do seu escopo',
      scopePrefix: (scope: string): string => `Escopo: ${scope}`,
      calculatedAt: (time: string): string => `Calculados às ${time}`,
      refreshAction: 'Atualizar',
      refreshing: 'Atualizando indicadores…',
      monitoringNone: 'Nenhum indicador com limite configurado',
      monitoringSummary: (monitored: number, breached: number): string =>
        `${monitored} com limite configurado · ${breached} com limite rompido na última medição`,
    },

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
      scrollBack: 'Rolar filtros de domínio para a esquerda',
      scrollForward: 'Rolar filtros de domínio para a direita',
    },

    sections: {
      distributionTitle: 'Composição por nível e severidade',
      singleValueTitle: 'Contagens e percentuais',
    },

    card: {
      totalCaption: 'Total',
      legendLabel: (metricLabel: string): string => `Distribuição de ${metricLabel}`,
      bucketLinkAccessibleLabelByLevel: (count: number, levelLabel: string): string =>
        `${count.toLocaleString('pt-BR')} riscos de nível ${levelLabel} — ver registros`,
      bucketLinkAccessibleLabelBySeverity: (
        count: number,
        domainNoun: string,
        levelLabel: string,
      ): string =>
        `${count.toLocaleString('pt-BR')} ${domainNoun} de severidade ${levelLabel} — ver registros`,
      thresholdLabel: (comparatorSymbol: string, value: number): string =>
        `Limite: ${comparatorSymbol} ${value.toLocaleString('pt-BR')}`,
      viewRecordsAction: 'Ver registros',
      viewRecordsAccessibleLabel: (metricLabel: string): string =>
        `Ver registros de ${metricLabel}`,
      scopeNoteOrganizationWide: 'Este indicador é sempre calculado para a organização inteira.',
    },

    states: {
      requiresPermission: (moduleLabel: string): string => `Requer permissão de ${moduleLabel}`,
      requiresPermissionHint:
        'Você não tem a permissão do domínio de origem para ver este indicador.',
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
