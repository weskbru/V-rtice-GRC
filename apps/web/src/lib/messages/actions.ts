import type { AuditOutcome } from '@/features/actions/types';
import type { GrcFoundation } from '@pharos/api-types';
import type { StatusVariant } from '@pharos/design-system/components';

export type ActionOriginType = GrcFoundation.components['schemas']['ActionOriginType'];

export type ActionStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

const AUDIT_OUTCOME_LABELS: Record<AuditOutcome, string> = {
  SUCCESS: 'Sucesso',
  FAILURE: 'Falha',
  DENIED: 'Negado',
};

function auditOutcomeVariant(outcome: string): StatusVariant {
  if (outcome === 'SUCCESS') return 'success';
  if (outcome === 'DENIED' || outcome === 'FAILURE') return 'danger';
  return 'neutral';
}

const ACTION_AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  responsibleUserId: 'Responsável',
  dueOn: 'Prazo',
  status: 'Status',
  reason: 'Motivo',
  originType: 'Tipo de origem',
  originId: 'Origem',
};

function actionAuditFieldLabel(key: string): string {
  return ACTION_AUDIT_FIELD_LABELS[key] ?? key;
}

export const actions = {
  originTypeLabels: {
    RISK_TREATMENT: 'Tratamento de risco',
    FINDING: 'Achado',
    CONTROL_ASSESSMENT: 'Verificação de controle',
    INCIDENT: 'Incidente',
    PROBLEM: 'Problema',
  } satisfies Record<ActionOriginType, string>,

  statusLabels: {
    OPEN: 'Aberta',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  } satisfies Record<ActionStatus, string>,

  myActions: {
    pageTitle: 'Planos de Ação',
    pageDescription:
      'Todas as ações de plano de ação do seu escopo de acesso, agregadas de qualquer origem — ' +
      'tratamento de risco, achado de auditoria, verificação de controle, incidente ou problema. ' +
      'Use "Somente minhas ações" para ver apenas o que está atribuído a você.',
    tableCaption: 'Lista de ações do plano de ação visíveis no seu escopo',

    columns: {
      code: 'Código',
      title: 'Título',
      origin: 'Origem',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      status: 'Status',
      actions: 'Ações',
    },

    indicators: {
      overdue: 'Atrasada',
    },

    filters: {
      regionLabel: 'Filtros das ações',
      groupLabel: 'Filtros',
      onlyMine: 'Somente minhas ações',
      onlyOverdue: 'Somente atrasadas',
      statusLabel: 'Status',
      statusAll: 'Todos os status',
      originLabel: 'Origem',
      originAll: 'Todas as origens',
      clearFilters: 'Limpar filtros',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      valueChip: (field: string, value: string): string => `${field}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
      onlyMineOffLabel: 'Todas as ações (não somente as minhas)',
    },

    summary: {
      regionLabel: 'Situação geral das ações no seu escopo',
      open: {
        label: 'Abertas',
        hint: 'Ainda não iniciadas',
        linkLabel: 'Filtrar o registro por ações abertas',
      },
      inProgress: {
        label: 'Em andamento',
        hint: 'Trabalho já iniciado',
        linkLabel: 'Filtrar o registro por ações em andamento',
      },
      dueSoon: {
        label: 'Vencendo em breve',
        hint: (days: number): string => `Prazo nos próximos ${days} dias`,
        linkLabel: 'Ver todas as ações, sem filtro de origem ou status',
      },
      completed: {
        label: 'Concluídas',
        hint: 'Já finalizadas',
        linkLabel: 'Filtrar o registro por ações concluídas',
      },
      loading: 'Carregando indicadores…',
      error: 'Não foi possível carregar os indicadores.',
    },

    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver as ações em cards',
      tableLabel: 'Ver as ações em tabela',
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 ação' : `${total.toLocaleString('pt-BR')} ações`,
      countLoading: 'Carregando ações…',
    },

    card: {
      regionLabel: 'Ações',
      originLabel: 'Origem',
      responsibleLabel: 'Responsável',
      dueOnLabel: 'Prazo',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      openLabel: (code: string, title: string): string => `Abrir a ação ${code}: ${title}`,
      rowActionsLabel: 'Ações',
    },

    empty: {
      noneYet: {
        title: 'Nenhuma ação atribuída a você',
        description:
          'Quando uma ação de remediação for atribuída a você — a partir de um tratamento de ' +
          'risco ou de outra origem — ela aparecerá aqui.',
      },
      noResults: {
        title: 'Nenhuma ação encontrada',
        description: 'Nenhuma ação corresponde aos filtros atuais.',
        clearAction: 'Limpar filtros',
      },
    },

    transitions: {
      confirmTitle: 'Confirmar transição',
      confirmDescription: (actionTitle: string, toLabel: string): string =>
        `A ação "${actionTitle}" será movida para o status "${toLabel}".`,
      reopenTitle: 'Reabrir ação',
      reopenDescription:
        'Reabrir uma ação concluída exige uma justificativa, registrada na trilha de auditoria.',
      reopenReasonLabel: 'Motivo da reabertura',
      reopenReasonPlaceholder: 'Descreva por que esta ação está sendo reaberta…',
      reopenReasonRequired: 'Informe o motivo da reabertura.',
      confirm: 'Confirmar',
      cancelDialog: 'Cancelar',
      transitionFailed: 'Não foi possível aplicar a transição.',
      transitionSuccess: (toLabel: string): string => `Ação movida para "${toLabel}".`,
      reopenSuccess: 'Ação reaberta.',
    },
  },

  detail: {
    breadcrumbLabel: 'Planos de Ação',
    loading: 'Carregando ação…',
    notFoundTitle: 'Ação não encontrada',
    notFoundDescription:
      'Esta ação não existe ou está fora do seu escopo de acesso. Se você acredita que deveria ' +
      'vê-la, procure um administrador.',
    errorLoad: 'Não foi possível carregar a ação.',
    forbidden: {
      title: 'Sem permissão para ver esta ação',
      detail:
        'Você não tem a permissão necessária para ver ações. Se isso não for esperado, procure ' +
        'um administrador.',
    },
    editAction: 'Editar',

    metadata: {
      orgUnit: (name: string): string => `Unidade organizacional: ${name}`,
      responsible: (name: string): string => `Responsável: ${name}`,
      dueOn: (date: string): string => `Prazo: ${date}`,
    },

    sections: {
      overview: 'Visão geral',
      audit: 'Auditoria',
    },

    lifecycleOutcomes: {
      completedAtLabel: 'Concluída em',
      reopenedAtLabel: 'Reaberta em',
    },

    lifecycleTrack: {
      mainAriaLabel: 'Posições do ciclo de vida da ação',
      cancelledAriaLabel: 'Ação cancelada',
      cancelledContextLabel: 'Encerrada por cancelamento',
      stateLabels: {
        current: 'Atual',
        completed: 'Concluído',
        available: 'Disponível',
        unavailable: 'Indisponível',
      },
    },

    form: {
      editHeading: 'Editar ação',
      editDescription: 'Altere os dados cadastrais da ação.',
      titleLabel: 'Título',
      descriptionLabel: 'Descrição',
      responsibleLabel: 'Responsável',
      responsiblePlaceholder: 'Selecione um responsável',
      dueOnLabel: 'Prazo',
      validation: {
        titleRequired: 'Informe o título.',
        responsibleRequired: 'Selecione um responsável.',
        dueOnRequired: 'Informe o prazo.',
      },
      submit: 'Salvar alterações',
      submitting: 'Salvando…',
      cancel: 'Cancelar',
      updateSuccess: 'Ação atualizada.',
      updateError: 'Não foi possível salvar as alterações.',
    },

    audit: {
      cardTitle: 'Trilha de auditoria',
      cardDescription:
        'Registro completo e imutável de eventos desta ação — quem, quando, o quê e o resultado ' +
        'de cada ação. Nenhum evento pode ser alterado ou excluído.',
      caption: 'Trilha de auditoria',
      loading: 'Carregando trilha de auditoria…',
      loadError: 'Não foi possível carregar a trilha de auditoria.',
      empty: 'Nenhum evento de auditoria registrado ainda.',
      occurredAtLabel: 'Ocorrido em',
      actorLabel: 'Ator',
      entityLabel: 'Entidade',
      notRecordedLabel: 'Não registrado',
      changedFieldsLabel: 'Campos alterados',
      ipAddressLabel: 'Endereço IP',
      userAgentLabel: 'Navegador/dispositivo',
      correlationIdLabel: 'ID de correlação',
      loadMoreLabel: 'Carregar mais',
      loadingMoreLabel: 'Carregando mais…',
      outcomeLabel: (outcome: string): string =>
        AUDIT_OUTCOME_LABELS[outcome as AuditOutcome] ?? outcome,
      outcomeVariant: auditOutcomeVariant,
      fieldLabel: actionAuditFieldLabel,
      forbidden: {
        title: 'Sem permissão para ver a trilha de auditoria',
        detail:
          'Você pode ver esta ação, mas não tem a permissão necessária para ver sua trilha de ' +
          'auditoria. Se isso não for esperado, procure um administrador.',
      },
    },
  },

  overview: {
    descriptionCardTitle: 'Descrição',
    descriptionEmpty: 'Nenhuma descrição registrada.',
    originCardTitle: 'Origem',
    detailsCardTitle: 'Detalhes da ação',
    fields: {
      orgUnit: 'Unidade organizacional',
      responsible: 'Responsável',
      dueOn: 'Prazo',
      createdAt: 'Criada em',
      updatedAt: 'Atualizada em',
    },
    notSet: 'Não definido',
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Trajetória e transições disponíveis para esta ação.',
  },

  transitions: {
    start: 'Iniciar',
    complete: 'Concluir',
    cancel: 'Cancelar',
    reopen: 'Reabrir',
  },
} as const;
