import type { SeededRoleName } from '@/features/admin/types';

export const common = {
  userStatus: {
    active: 'Ativo',
    inactive: 'Inativo',
  },
  roleDisplayNames: {
    'Platform Administrator': 'Administrador da Plataforma',
    'Risk Manager': 'Gestor de Riscos',
    'Risk Analyst': 'Analista de Riscos',
    'Risk Approver': 'Aprovador de Riscos',
    'Control Owner': 'Responsável por Controle',
    'Control Approver': 'Aprovador de Controle',
    'Compliance Manager': 'Gestor de Compliance',
    Auditor: 'Auditor',
    'Read Only': 'Somente Leitura',
    'Audit Lead': 'Líder de Auditoria',
    'Incident Manager': 'Gestor de Incidentes',
    'Problem Manager': 'Gestor de Problemas',
  } satisfies Record<SeededRoleName, string>,
  actions: {
    save: 'Salvar',
    cancel: 'Cancelar',
    edit: 'Editar',
    create: 'Criar',
    add: 'Adicionar',
    remove: 'Remover',
    back: 'Voltar',
    retry: 'Tentar novamente',
    clearFilters: 'Limpar filtros',
    clear: 'Limpar',
  },
  filters: {
    noOptions: 'Nenhuma opção disponível.',
  },
  dataTable: {
    loading: 'Carregando dados…',
    rowsPerPageLabel: 'Itens por página',
    goToPageLabel: 'Ir para a página',
    goToPageToggleLabel: 'Ir para uma página específica',
    resultsSummary: (from: number, to: number, total: number): string =>
      total === 0
        ? 'Nenhum resultado'
        : `${from.toLocaleString('pt-BR')}–${to.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`,
    previousPageLabel: 'Página anterior',
    nextPageLabel: 'Próxima página',
    pageNumberLabel: (page: number): string => `Ir para a página ${page}`,
    sort: {
      ascending: '(ordenado de forma crescente)',
      descending: '(ordenado de forma decrescente)',
      none: '(não ordenado — ativar para ordenar)',
    },
  },
  entityTabs: {
    sectionsAriaLabel: 'Seções do registro',
    scrollBack: 'Rolar seções para a esquerda',
    scrollForward: 'Rolar seções para a direita',
  },
  confirmDialog: {
    cancel: 'Cancelar',
    close: 'Fechar',
  },
  formField: {
    optionalIndicator: '(opcional)',
  },
  dialog: {
    closeLabel: 'Fechar',
  },

  commandPalette: {
    defaultTitle: 'Paleta de comandos',
    defaultDescription: 'Buscar um comando para executar…',
  },

  searchablePicker: {
    loadingText: 'Buscando…',
    partialResultsText: (shownCount: number): string =>
      `Mostrando os primeiros ${String(shownCount)} resultados — refine a busca para ver mais.`,
  },

  userPicker: {
    searchPlaceholder: 'Buscar por nome ou e-mail…',
    emptyText: 'Nenhum usuário encontrado.',
    clearLabel: 'Limpar',
  },

  toaster: {
    regionAriaLabel: 'Notificações',
    closeButtonAriaLabel: 'Fechar notificação',
  },
} as const;
