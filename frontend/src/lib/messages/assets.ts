import type { AssetListSortField, IncidentStatusRef } from '@/features/assets/types';
import type { StatusVariant } from '@pharos/design-system/components';

const SITUATION_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
} as const;

const SITUATION_VARIANT: Record<keyof typeof SITUATION_LABELS, StatusVariant> = {
  active: 'success',
  inactive: 'neutral',
};

export const assets = {
  situationLabels: SITUATION_LABELS,
  situationVariant: SITUATION_VARIANT,

  register: {
    pageTitle: 'Ativos',
    pageDescription:
      'Inventário de ativos da organização: o que a organização possui ou opera, sua unidade e a que riscos e controles está vinculado.',
    createAction: 'Novo ativo',
    tableCaption: 'Lista de ativos cadastrados',

    summary: {
      regionLabel: 'Resumo do inventário de ativos',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de ativos',
        hint: 'Todos os ativos no seu escopo',
        linkLabel: 'Ver todos os ativos',
      },
      active: {
        label: 'Ativos em uso',
        hint: 'Situação ativa — aceitam novos vínculos',
        linkLabel: 'Ver ativos em uso',
      },
      inactive: {
        label: 'Ativos desativados',
        hint: 'Situação inativa — não aceitam novos vínculos',
        linkLabel: 'Ver ativos desativados',
      },
    },

    view: {
      cards: 'Cards',
      cardsLabel: 'Exibir como cards',
      table: 'Tabela',
      tableLabel: 'Exibir como tabela',
      groupLabel: 'Modo de exibição',
    },

    filters: {
      regionLabel: 'Filtros do inventário de ativos',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar ativos',
      searchPlaceholder: 'Buscar por código ou nome…',
      orgUnitLabel: 'Unidade organizacional',
      situationLabel: 'Situação',
      situationAll: 'Todas as situações',
      situationActive: 'Ativo',
      situationInactive: 'Inativo',
      loadingOptions: 'Carregando opções…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (term: string): string => `Busca: "${term}"`,
      valueChip: (fieldLabel: string, value: string): string => `${fieldLabel}: ${value}`,
      removeLabel: (text: string): string => `Remover filtro: ${text}`,
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 ativo' : `${total.toLocaleString('pt-BR')} ativos`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        name: 'Nome',
        updatedAt: 'Última atualização',
      } satisfies Record<AssetListSortField, string>,
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} — ${directionLabel}`,
      sortOptions: {
        'code:asc': 'Código — crescente',
        'code:desc': 'Código — decrescente',
        'name:asc': 'Nome — crescente',
        'name:desc': 'Nome — decrescente',
        'updatedAt:asc': 'Última atualização — crescente',
        'updatedAt:desc': 'Última atualização — decrescente',
      } as Record<string, string>,
    },

    columns: {
      code: 'Código',
      name: 'Nome',
      orgUnit: 'Unidade organizacional',
      situation: 'Situação',
      updatedAt: 'Última atualização',
      notSet: 'Não definida',
    },

    card: {
      regionLabel: 'Ativos',
      selectLabel: (code: string, name: string): string => `Abrir ativo ${code} — ${name}`,
      orgUnitLabel: 'Unidade',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    loading: 'Carregando ativos…',
    loadError: 'Não foi possível carregar o inventário de ativos.',
    retryAction: 'Tentar novamente',

    empty: {
      noneYet: {
        title: 'Nenhum ativo cadastrado',
        description:
          'Cadastre o primeiro ativo da sua unidade organizacional para começar a vinculá-lo a riscos e controles.',
        createAction: 'Cadastrar ativo',
      },
      noResults: {
        title: 'Nenhum ativo encontrado',
        description: 'Nenhum ativo corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  detail: {
    breadcrumbLabel: 'Ativos',
    loading: 'Carregando ativo…',
    notFoundTitle: 'Ativo não encontrado',
    notFoundDescription:
      'Este ativo não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    backToRegister: 'Voltar ao inventário de ativos',
    metadata: {
      orgUnit: (name: string): string => `Unidade: ${name}`,
      noOrgUnit: 'Unidade não definida',
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos',
      controls: 'Controles',
      incidents: 'Incidentes',
    },
    overview: {
      descriptionCardTitle: 'Descrição',
      noDescription: 'Sem descrição.',
      detailsCardTitle: 'Detalhes do ativo',
      orgUnitLabel: 'Unidade organizacional',
      createdAtLabel: 'Cadastrado em',
      updatedAtLabel: 'Atualizado em',
      notSet: 'Não definido',
    },
    asideLabel: 'Contexto do ativo',
    relationshipsPanel: {
      heading: 'Relacionamentos',
      risks: (count: number): string => `Riscos (${count})`,
      controls: (count: number): string => `Controles (${count})`,
      incidents: 'Incidentes',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',
  },

  linkedRisks: {
    sectionDescription:
      'Riscos que referenciam este ativo. Vínculos são criados e desfeitos a partir do registro do risco.',
    columns: { code: 'Código', title: 'Título' },
    empty: 'Nenhum risco vinculado a este ativo.',
    loadError: 'Não foi possível carregar os riscos vinculados a este ativo.',
  },
  linkedControls: {
    sectionDescription:
      'Controles que atuam sobre este ativo. Vínculos são criados e desfeitos a partir do registro do controle.',
    columns: { code: 'Código', name: 'Nome' },
    empty: 'Nenhum controle vinculado a este ativo.',
    loadError: 'Não foi possível carregar os controles vinculados a este ativo.',
  },
  linkedIncidents: {
    sectionDescription:
      'Incidentes que referenciam este ativo. Vínculos são criados e desfeitos a partir do registro do incidente.',
    columns: { code: 'Código', title: 'Título', status: 'Status' },
    empty: 'Nenhum incidente vinculado a este ativo.',
    loading: 'Carregando incidentes vinculados…',
    loadError: 'Não foi possível carregar os incidentes vinculados a este ativo.',
    statusLabels: {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
      CANCELLED: 'Cancelado',
    } satisfies Record<IncidentStatusRef, string>,
  },

  form: {
    createTitle: 'Novo ativo',
    createDescription:
      'Cadastre um ativo informando o que ele é e a que unidade organizacional pertence.',
    editTitle: 'Editar ativo',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este ativo é e a que unidade organizacional pertence.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: {
        label: 'Descrição',
        helper: 'Opcional. Descreva o que este ativo é e para que serve.',
      },
      orgUnit: {
        label: 'Unidade organizacional',
        placeholder: 'Selecione a unidade',
        helper: 'Obrigatória. Define quem enxerga e pode vincular este ativo.',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Cadastrar ativo',
      creating: 'Cadastrando…',
    },
    createSuccess: 'Ativo cadastrado.',
    updateSuccess: 'Ativo atualizado.',
    genericError: 'Não foi possível salvar o ativo. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    validation: {
      name: {
        required: 'Informe o nome do ativo.',
        tooLong: 'O nome deve ter no máximo 300 caracteres.',
      },
      orgUnit: {
        required: 'Selecione a unidade organizacional. Este campo é obrigatório.',
        invalid: 'A unidade selecionada não existe ou está fora do seu escopo de acesso.',
      },
    },
  },

  lifecycle: {
    cardTitle: 'Situação',
    cardDescription: 'Situação atual do ativo e as ações disponíveis para alterá-la.',
    deactivate: {
      action: 'Desativar',
      confirmTitle: 'Desativar este ativo?',
      confirmDescription:
        'O ativo deixa de poder ser vinculado a novos riscos e controles a partir de agora. Ele continua totalmente legível e continua aparecendo nos vínculos que já existem — nada é apagado, e a transição fica registrada na trilha de auditoria.',
      confirmAction: 'Desativar',
      confirming: 'Desativando…',
      success: 'Ativo desativado.',
      genericError: 'Não foi possível desativar o ativo. Tente novamente.',
      alreadyInactiveError: 'Este ativo já está inativo.',
    },
    reactivate: {
      action: 'Reativar',
      confirmTitle: 'Reativar este ativo?',
      confirmDescription:
        'O ativo volta a poder ser vinculado a riscos e controles novos. Os vínculos criados enquanto estava inativo, se houver, não foram afetados pela desativação.',
      confirmAction: 'Reativar',
      confirming: 'Reativando…',
      success: 'Ativo reativado.',
      genericError: 'Não foi possível reativar o ativo. Tente novamente.',
      alreadyActiveError: 'Este ativo já está ativo.',
    },
  },
} as const;
