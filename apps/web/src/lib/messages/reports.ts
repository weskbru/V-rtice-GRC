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
      notSet: 'Nenhum indicador',
    },
    metricCountLabel: (count: number): string =>
      count === 1 ? '1 indicador' : `${count} indicadores`,
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
    results: {
      count: (total: number): string =>
        total === 1 ? '1 relatório' : `${total.toLocaleString('pt-BR')} relatórios`,
      countLoading: 'Carregando resultados…',
    },
    createForbidden: {
      title: 'Sem permissão para criar relatórios',
      description:
        'Você tem acesso à lista de relatórios, mas não tem a permissão necessária para criar um novo. Se isso não for esperado, procure um administrador.',
      backAction: 'Voltar para Relatórios',
    },
  },

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

  run: {
    triggerAction: 'Executar',
    dialogDescriptionFallback: 'Valor atual de cada indicador incluído neste relatório.',
    loading: 'Executando relatório…',
    loadError: 'Não foi possível executar este relatório agora.',
    computedAtLabel: (formatted: string): string => `Executado em ${formatted}`,
    itemUnavailable: {
      label: 'Sem permissão para ver este item',
      hint: 'Este indicador exige uma permissão adicional do domínio de origem.',
    },
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
