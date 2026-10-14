import type { IncidentStatusRef, ProcessListSortField } from '@/features/processes/types';
import type { StatusVariant } from '@vertice/design-system/components';

const SITUATION_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo',
} as const;

const SITUATION_VARIANT: Record<keyof typeof SITUATION_LABELS, StatusVariant> = {
  active: 'success',
  inactive: 'neutral',
};

export const processes = {
  situationLabels: SITUATION_LABELS,
  situationVariant: SITUATION_VARIANT,

  register: {
    pageTitle: 'Processos',
    pageDescription:
      'Catálogo de processos da organização: o que a organização executa, sua unidade e a que riscos e controles está vinculado.',
    createAction: 'Novo processo',
    tableCaption: 'Lista de processos cadastrados',

    summary: {
      regionLabel: 'Resumo do catálogo de processos',
      error: 'Não foi possível carregar os indicadores.',
      total: {
        label: 'Total de processos',
        hint: 'Todos os processos no seu escopo',
        linkLabel: 'Ver todos os processos',
      },
      active: {
        label: 'Processos em uso',
        hint: 'Situação ativa — aceitam novos vínculos',
        linkLabel: 'Ver processos em uso',
      },
      inactive: {
        label: 'Processos desativados',
        hint: 'Situação inativa — não aceitam novos vínculos',
        linkLabel: 'Ver processos desativados',
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
      regionLabel: 'Filtros do catálogo de processos',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar processos',
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
        total === 1 ? '1 processo' : `${total.toLocaleString('pt-BR')} processos`,
      countLoading: 'Carregando resultados…',
      sortLabel: 'Ordenar por',
      sortFieldLabels: {
        code: 'Código',
        name: 'Nome',
        updatedAt: 'Última atualização',
      } satisfies Record<ProcessListSortField, string>,
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
      regionLabel: 'Processos',
      selectLabel: (code: string, name: string): string => `Abrir processo ${code} — ${name}`,
      orgUnitLabel: 'Unidade',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },

    loading: 'Carregando processos…',
    loadError: 'Não foi possível carregar o catálogo de processos.',
    retryAction: 'Tentar novamente',

    empty: {
      noneYet: {
        title: 'Nenhum processo cadastrado',
        description:
          'Cadastre o primeiro processo da sua unidade organizacional para começar a vinculá-lo a riscos e controles.',
        createAction: 'Cadastrar processo',
      },
      noResults: {
        title: 'Nenhum processo encontrado',
        description: 'Nenhum processo corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },
  },

  detail: {
    loading: 'Carregando processo…',
    notFoundTitle: 'Processo não encontrado',
    notFoundDescription:
      'Este processo não existe ou está fora do seu escopo organizacional de acesso.',
    editAction: 'Editar',
    breadcrumbLabel: 'Processos',
    backToRegister: 'Voltar ao catálogo de processos',
    metadata: {
      orgUnit: (name: string): string => `Unidade: ${name}`,
      noOrgUnit: 'Unidade não definida',
      createdAt: (date: string): string => `Cadastrado em ${date}`,
      updatedAt: (date: string): string => `Atualizado em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      risks: 'Riscos vinculados',
      controls: 'Controles vinculados',
      incidents: 'Incidentes vinculados',
    },
    overview: {
      descriptionLabel: 'Descrição',
      descriptionCardTitle: 'Descrição',
      detailsCardTitle: 'Contexto do processo',
      noDescription: 'Sem descrição.',
      notSet: 'Não definido',
      situationLabel: 'Situação',
      orgUnitLabel: 'Unidade organizacional',
      createdAtLabel: 'Cadastrado em',
      updatedAtLabel: 'Atualizado em',
    },
    asideLabel: 'Contexto do processo',
    relationshipsPanel: {
      heading: 'Relacionamentos',
      risks: (count: number): string => `Riscos vinculados (${count})`,
      controls: (count: number): string => `Controles vinculados (${count})`,
      incidents: 'Incidentes vinculados',
      viewHint: 'Ver',
    },
    lastUpdatedHeading: 'Última atualização',
  },

  linkedRisks: {
    sectionDescription:
      'Riscos que referenciam este processo. Vínculos são criados e desfeitos a partir do registro do risco.',
    columns: { code: 'Código', title: 'Título' },
    empty: 'Nenhum risco vinculado a este processo.',
    loadError: 'Não foi possível carregar os riscos vinculados a este processo.',
  },
  linkedControls: {
    sectionDescription:
      'Controles que atuam sobre este processo. Vínculos são criados e desfeitos a partir do registro do controle.',
    columns: { code: 'Código', name: 'Nome' },
    empty: 'Nenhum controle vinculado a este processo.',
    loadError: 'Não foi possível carregar os controles vinculados a este processo.',
  },
  linkedIncidents: {
    sectionDescription:
      'Incidentes que referenciam este processo. Vínculos são criados e desfeitos a partir do registro do incidente.',
    columns: { code: 'Código', title: 'Título', status: 'Status' },
    empty: 'Nenhum incidente vinculado a este processo.',
    loading: 'Carregando incidentes vinculados…',
    loadError: 'Não foi possível carregar os incidentes vinculados a este processo.',
    statusLabels: {
      OPEN: 'Aberto',
      IN_PROGRESS: 'Em andamento',
      RESOLVED: 'Resolvido',
      CLOSED: 'Fechado',
      CANCELLED: 'Cancelado',
    } satisfies Record<IncidentStatusRef, string>,
  },

  form: {
    createTitle: 'Novo processo',
    createDescription:
      'Cadastre um processo informando o que ele é e a que unidade organizacional pertence.',
    editTitle: 'Editar processo',
    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que este processo é e a que unidade organizacional pertence.',
      },
    },
    fields: {
      name: { label: 'Nome' },
      description: {
        label: 'Descrição',
        helper: 'Opcional. Descreva o que este processo faz.',
      },
      orgUnit: {
        label: 'Unidade organizacional',
        placeholder: 'Selecione a unidade',
        helper: 'Obrigatória. Define quem enxerga e pode vincular este processo.',
      },
    },
    unsavedNote: 'As alterações só são salvas ao confirmar.',
    actions: {
      save: 'Salvar alterações',
      saving: 'Salvando…',
      saveAndCreate: 'Cadastrar processo',
      creating: 'Cadastrando…',
    },
    createSuccess: 'Processo cadastrado.',
    updateSuccess: 'Processo atualizado.',
    genericError: 'Não foi possível salvar o processo. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    referenceDataError: 'Não foi possível carregar os dados de referência do formulário.',
    validation: {
      name: {
        required: 'Informe o nome do processo.',
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
    cardDescription: 'Situação atual do processo e as ações disponíveis para alterá-la.',
    deactivate: {
      action: 'Desativar',
      confirmTitle: 'Desativar este processo?',
      confirmDescription:
        'O processo deixa de poder ser vinculado a novos riscos e controles a partir de agora. Ele continua totalmente legível e continua aparecendo nos vínculos que já existem — nada é apagado, e a transição fica registrada na trilha de auditoria.',
      confirmAction: 'Desativar',
      confirming: 'Desativando…',
      success: 'Processo desativado.',
      genericError: 'Não foi possível desativar o processo. Tente novamente.',
      alreadyInactiveError: 'Este processo já está inativo.',
    },
    reactivate: {
      action: 'Reativar',
      confirmTitle: 'Reativar este processo?',
      confirmDescription:
        'O processo volta a poder ser vinculado a riscos e controles novos. Os vínculos criados enquanto estava inativo, se houver, não foram afetados pela desativação.',
      confirmAction: 'Reativar',
      confirming: 'Reativando…',
      success: 'Processo reativado.',
      genericError: 'Não foi possível reativar o processo. Tente novamente.',
      alreadyActiveError: 'Este processo já está ativo.',
    },
  },
} as const;
