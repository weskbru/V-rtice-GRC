import { formatDateOnly } from '@/features/risks/date';

import type {
  AuditOutcome,
  IncidentStatusRef,
  OrgUnitNode,
  ProblemStatusRef,
  ReferenceDataItem,
  RiskHistoryEntryType,
  RiskLevel,
  RiskStatus,
  TreatmentStrategy,
  UserRef,
} from '@/features/risks/types';
import type { StatusVariant } from '@vertice/design-system/components';

const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

const RISK_STATUS_LABELS: Record<RiskStatus, string> = {
  DRAFT: 'Rascunho',
  IDENTIFIED: 'Identificado',
  ASSESSED: 'Avaliado',
  UNDER_TREATMENT: 'Em tratamento',
  UNDER_REVIEW: 'Em revisão',
  ACCEPTED: 'Aceito',
  CLOSED: 'Encerrado',
  ARCHIVED: 'Arquivado',
};

function levelName(level: RiskLevel): string {
  return RISK_LEVEL_LABELS[level];
}

const TREATMENT_STRATEGY_LABELS: Record<TreatmentStrategy, string> = {
  MITIGATE: 'Mitigar',
  ACCEPT: 'Aceitar',
  TRANSFER: 'Transferir',
  AVOID: 'Evitar',
};

const RISK_HISTORY_ENTRY_TYPE_LABELS: Record<RiskHistoryEntryType, string> = {
  ASSESSMENT: 'Avaliação',
  LEVEL_CHANGE: 'Variação de nível',
  OWNERSHIP_CHANGE: 'Alteração de responsável',
  TREATMENT_DECISION: 'Decisão de tratamento',
  TREATMENT_ACTION: 'Ação de tratamento',
  CONTROL_LINK: 'Vínculo de controle',
  LIFECYCLE_TRANSITION: 'Transição de status',
  APPROVAL: 'Aprovação',
  FIELD_CHANGE: 'Alteração de campo',
};

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

const AUDIT_DECISION_LABELS: Record<'APPROVED' | 'REJECTED', string> = {
  APPROVED: 'Aprovado',
  REJECTED: 'Rejeitado',
};

const AUDIT_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  categoryId: 'Categoria',
  typeId: 'Tipo',
  originId: 'Origem',
  orgUnitId: 'Unidade organizacional',
  ownerUserId: 'Gestor do risco',
  responsibleUserId: 'Responsável',
  identifiedOn: 'Data de identificação',
  nextReviewOn: 'Próxima revisão',
  causes: 'Causas',
  consequences: 'Consequências',
  riskId: 'Risco',
  methodologyVersionId: 'Versão da metodologia',
  assessedOn: 'Data da avaliação',
  inherentProbability: 'Probabilidade inerente',
  inherentImpact: 'Impacto inerente',
  inherentScore: 'Pontuação inerente',
  inherentLevel: 'Nível inerente',
  residualProbability: 'Probabilidade residual',
  residualImpact: 'Impacto residual',
  residualScore: 'Pontuação residual',
  residualLevel: 'Nível residual',
  controlsConsidered: 'Controles considerados',
  previousAssessmentId: 'Avaliação anterior',
  methodologyId: 'Metodologia',
  versionNumber: 'Número da versão',
  effectiveFrom: 'Vigente a partir de',
  strategy: 'Estratégia',
  deadline: 'Prazo',
  previousTreatmentDecisionId: 'Decisão de tratamento anterior',
  treatmentDecisionId: 'Decisão de tratamento',
  dueOn: 'Prazo',
  status: 'Situação',
  controlId: 'Controle',
  processId: 'Processo',
  assetId: 'Ativo',
  unlinkedAt: 'Desvinculado em',
  fromStatus: 'Status anterior',
  toStatus: 'Novo status',
  justification: 'Justificativa',
  approvalId: 'Aprovação',
  requestedTransition: 'Transição solicitada',
  decision: 'Decisão',
};

function auditFieldLabel(key: string): string {
  return AUDIT_FIELD_LABELS[key] ?? key;
}

export interface AuditReferenceData {
  categories: readonly ReferenceDataItem[];
  types: readonly ReferenceDataItem[];
  origins: readonly ReferenceDataItem[];
  orgUnits: readonly OrgUnitNode[];
  users: readonly UserRef[];
}

const AUDIT_DATE_ONLY_FIELDS = new Set([
  'identifiedOn',
  'nextReviewOn',
  'assessedOn',
  'dueOn',
  'deadline',
  'effectiveFrom',
]);

const AUDIT_TIMESTAMP_FIELDS = new Set(['unlinkedAt']);

function buildIdNameMap(items: readonly { id: string; name: string }[]): Map<string, string> {
  return new Map(items.map((item) => [item.id, item.name]));
}

export function buildAuditValueResolver(
  referenceData: AuditReferenceData,
): (key: string, value: unknown) => string | undefined {
  const categoryNames = buildIdNameMap(referenceData.categories);
  const typeNames = buildIdNameMap(referenceData.types);
  const originNames = buildIdNameMap(referenceData.origins);
  const orgUnitNames = buildIdNameMap(referenceData.orgUnits);
  const userNames = new Map(referenceData.users.map((user) => [user.id, user.fullName]));

  function resolveReferenceId(map: Map<string, string>, id: string): string {
    return map.get(id) ?? risks.audit.unresolvedReference(id);
  }

  function resolveScalarValue(key: string, value: string): string | undefined {
    switch (key) {
      case 'categoryId':
        return resolveReferenceId(categoryNames, value);
      case 'typeId':
        return resolveReferenceId(typeNames, value);
      case 'originId':
        return resolveReferenceId(originNames, value);
      case 'orgUnitId':
        return resolveReferenceId(orgUnitNames, value);
      case 'ownerUserId':
      case 'responsibleUserId':
        return resolveReferenceId(userNames, value);
      case 'status':
      case 'fromStatus':
      case 'toStatus':
        return RISK_STATUS_LABELS[value as RiskStatus] ?? value;
      case 'strategy':
        return TREATMENT_STRATEGY_LABELS[value as TreatmentStrategy] ?? value;
      case 'inherentLevel':
      case 'residualLevel':
        return RISK_LEVEL_LABELS[value as RiskLevel] ?? value;
      case 'decision':
        return AUDIT_DECISION_LABELS[value as 'APPROVED' | 'REJECTED'] ?? value;
      default:
        return undefined;
    }
  }

  function safeStringifyArrayItem(item: unknown): string {
    try {
      return JSON.stringify(item);
    } catch {
      return Object.prototype.toString.call(item);
    }
  }

  return (key: string, value: unknown): string | undefined => {
    if (typeof value === 'string' && AUDIT_DATE_ONLY_FIELDS.has(key)) {
      return formatDateOnly(value.slice(0, 10));
    }
    if (typeof value === 'string' && AUDIT_TIMESTAMP_FIELDS.has(key)) {
      return new Date(value).toLocaleString('pt-BR');
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return risks.audit.emptyCollectionLabel;
      }
      return value
        .map((item) =>
          typeof item === 'string'
            ? (resolveScalarValue(key, item) ?? item)
            : safeStringifyArrayItem(item),
        )
        .join('; ');
    }
    if (typeof value !== 'string') {
      return undefined;
    }
    return resolveScalarValue(key, value);
  };
}

function basisNameFor(basis: 'inherent' | 'residual'): string {
  return basis === 'inherent' ? 'Inerente' : 'Residual';
}

const PENDING_APPROVAL_LABEL = 'Aguardando aprovação';

const riskLevelBadgeLabels = {
  levelName,
  basisPrefixedLevel: (basis: 'inherent' | 'residual', levelLabel: string): string =>
    `${basisNameFor(basis)}: ${levelLabel}`,
  accessibleLabel: (label: string): string => `Nível de risco: ${label}`,
};

const riskScoreLabels = {
  basisName: basisNameFor,
  levelName,
  scoreCaption: ({
    basisLabel,
    score,
    levelLabel,
  }: {
    basisLabel: string;
    score: number;
    levelLabel: string;
  }): string => `Pontuação ${basisLabel.toLowerCase()}: ${score} (${levelLabel})`,
  notAssessedCaption: (basisLabel: string): string =>
    `Risco ${basisLabel.toLowerCase()} ainda não avaliado.`,
  riskLevelBadge: riskLevelBadgeLabels,
};

function buildRiskMatrixLabels(caption: string) {
  return {
    probabilityAxisLabel: 'Probabilidade',
    impactAxisLabel: 'Impacto',
    cornerCellLabel: 'Probabilidade \\ Impacto',
    levelName,
    basisName: basisNameFor,
    basisAbbreviation: (basis: 'inherent' | 'residual'): string =>
      basis === 'inherent' ? 'I' : 'R',
    cellAccessibleLabel: ({
      probabilityLabel,
      impactLabel,
      score,
      levelLabel,
    }: {
      probabilityLabel: string;
      impactLabel: string;
      score: number;
      levelLabel: string;
    }): string =>
      `Probabilidade ${probabilityLabel}, Impacto ${impactLabel}: pontuação ${score}, nível ${levelLabel}`,
    caption,
  };
}

export const risks = {
  statusLabels: RISK_STATUS_LABELS,

  riskLevelLabels: RISK_LEVEL_LABELS,

  riskLevelBadge: riskLevelBadgeLabels,

  basisName: basisNameFor,

  riskScoreLabels,

  riskMatrixLabels: buildRiskMatrixLabels,

  form: {
    createTitle: 'Novo risco',
    createDescription: 'Registre um novo risco. É possível salvar incompleto e concluir depois.',
    editTitle: 'Editar risco',
    editDescription: 'Altere os dados cadastrais do risco.',

    sections: {
      identification: {
        title: 'Identificação',
        description: 'O que é este risco e como ele é classificado.',
      },
      ownership: {
        title: 'Responsabilidade e organização',
        description: 'Quem responde por este risco e em qual unidade organizacional.',
      },
      dates: {
        title: 'Datas',
        description: 'Quando o risco foi identificado e quando revisar novamente.',
      },
    },

    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição' },
      category: { label: 'Categoria', placeholder: 'Selecione uma categoria' },
      type: { label: 'Tipo', placeholder: 'Selecione um tipo' },
      origin: { label: 'Origem', placeholder: 'Selecione uma origem' },
      orgUnit: { label: 'Unidade organizacional', placeholder: 'Selecione uma unidade' },
      owner: {
        label: 'Gestor do risco',
        placeholder: 'Selecione o gestor do risco',
        description: 'Responsável final por este risco perante a organização.',
        selectOrgUnitFirst:
          'Selecione a unidade organizacional para ver os gestores disponíveis para essa unidade.',
        loading: 'Carregando gestores disponíveis para esta unidade…',
        empty: 'Nenhum usuário disponível para ser gestor nesta unidade organizacional.',
        loadError: 'Não foi possível carregar os gestores disponíveis para esta unidade.',
        clearedNotice:
          'O gestor selecionado não está mais disponível para a unidade organizacional escolhida e foi removido. Selecione outro gestor.',
      },
      responsible: {
        label: 'Responsável',
        placeholder: 'Selecione o responsável',
        description: 'Responsável pelo dia a dia do risco, quando diferente do gestor.',
        selectOrgUnitFirst:
          'Selecione a unidade organizacional para ver os responsáveis disponíveis para essa unidade.',
        loading: 'Carregando responsáveis disponíveis para esta unidade…',
        empty: 'Nenhum usuário disponível para ser responsável nesta unidade organizacional.',
        loadError: 'Não foi possível carregar os responsáveis disponíveis para esta unidade.',
        clearedNotice:
          'O responsável selecionado não está mais disponível para a unidade organizacional escolhida e foi removido.',
        clearAction: 'Remover responsável',
      },
      identifiedOn: { label: 'Data de identificação' },
      nextReviewOn: { label: 'Próxima revisão' },
    },

    unsavedNote:
      'Categoria, tipo, origem e responsável podem ser preenchidos depois — apenas título, descrição, unidade organizacional e gestor são exigidos para salvar como rascunho.',

    actions: {
      save: 'Salvar',
      saving: 'Salvando…',
      saveAndCreate: 'Criar risco',
      creating: 'Criando…',
    },

    loadingReferenceData: 'Carregando listas de apoio…',
    referenceDataError:
      'Não foi possível carregar as listas de categoria, tipo, unidade ou usuários.',

    createSuccess: 'Risco criado como rascunho.',
    updateSuccess: 'Alterações salvas.',
    genericError: 'Não foi possível salvar o risco. Tente novamente.',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',

    conflict: {
      title: 'Este risco foi alterado por outra pessoa',
      description:
        'Alguém salvou uma alteração neste risco enquanto você editava. Suas alterações abaixo NÃO foram perdidas e continuam preenchidas neste formulário, mas ainda não foram salvas — para não sobrescrever o que a outra pessoa fez, revise o que mudou antes de tentar salvar novamente.',
      modifiedBy: (name: string): string => `Alterado por: ${name}`,
      modifiedAt: (when: string): string => `Alterado em: ${when}`,
      reloadAction: 'Ver versão atual em nova aba',
      retryAction: 'Salvar mesmo assim com meus dados',
      dismissAction: 'Continuar editando',
    },
  },

  causesConsequences: {
    causesTitle: 'Causas',
    causesDescription: 'O que pode dar origem a este risco. Cada causa é um registro individual.',
    consequencesTitle: 'Consequências',
    consequencesDescription:
      'O que pode acontecer caso este risco se concretize. Cada consequência é um registro individual.',
    rowLabel: (kind: 'cause' | 'consequence', index: number): string =>
      kind === 'cause' ? `Causa ${index + 1}` : `Consequência ${index + 1}`,
    addCause: 'Adicionar causa',
    addConsequence: 'Adicionar consequência',
    removeCause: (index: number): string => `Remover causa ${index + 1}`,
    removeConsequence: (index: number): string => `Remover consequência ${index + 1}`,
    emptyCauses: 'Nenhuma causa registrada ainda.',
    emptyConsequences: 'Nenhuma consequência registrada ainda.',
    save: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Salvar causas' : 'Salvar consequências',
    saving: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Salvando causas…' : 'Salvando consequências…',
    saveSuccess: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Causas atualizadas.' : 'Consequências atualizadas.',
    saveError: 'Não foi possível salvar. Tente novamente.',
    rowRequired: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause'
        ? 'Descreva esta causa ou remova a linha.'
        : 'Descreva esta consequência ou remova a linha.',
    conflictError:
      'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de salvar.',

    editAction: (kind: 'cause' | 'consequence', index: number): string =>
      kind === 'cause' ? `Editar causa ${index + 1}` : `Editar consequência ${index + 1}`,
    confirmAction: 'Confirmar',
    newBadge: (kind: 'cause' | 'consequence'): string =>
      kind === 'cause' ? 'Nova causa' : 'Nova consequência',
    editingBadge: 'Editando',
    lockedHint: 'Confirme ou cancele a edição em andamento antes de iniciar outra.',
    removeConfirm: {
      title: (kind: 'cause' | 'consequence'): string =>
        kind === 'cause' ? 'Remover causa?' : 'Remover consequência?',
      description: (kind: 'cause' | 'consequence'): string =>
        kind === 'cause'
          ? 'Esta causa será removida da lista. A lista inteira é regravada ao confirmar.'
          : 'Esta consequência será removida da lista. A lista inteira é regravada ao confirmar.',
    },
  },

  detail: {
    breadcrumbLabel: 'Riscos',
    loading: 'Carregando risco…',
    notFoundTitle: 'Risco não encontrado',
    notFoundDescription:
      'Este risco não existe ou você não tem acesso a ele dentro do seu escopo organizacional.',
    editAction: 'Editar',
    metadata: {
      owner: (name: string): string => `Gestor: ${name}`,
      responsible: (name: string): string => `Responsável: ${name}`,
      orgUnit: (name: string): string => `Unidade: ${name}`,
      identifiedOn: (date: string): string => `Identificado em ${date}`,
      nextReviewOn: (date: string): string => `Próxima revisão em ${date}`,
    },
    sections: {
      overview: 'Visão geral',
      assessment: 'Avaliação',
      causesConsequences: 'Causas e Consequências',
      controls: 'Controles',
      treatment: 'Tratamento',
      actionPlans: 'Planos de Ação',
      history: 'Histórico',
      audit: 'Auditoria',
      attachments: 'Anexos',
      comments: 'Comentários',
      evidence: 'Evidência',
      findings: 'Achados',
      incidents: 'Incidentes',
      problems: 'Problemas',
      processesAssets: 'Processos e Ativos',
    },

    groups: {
      overview: 'Visão geral',
      analysis: 'Análise',
      response: 'Resposta',
      relationships: 'Relacionamentos',
      register: 'Registro',
    },
    groupsAriaLabel: 'Grupos de seções do risco',
    sectionsAriaLabel: (groupLabel: string): string => `Seções de ${groupLabel}`,
    asideLabel: 'Contexto do risco',

    summary: {
      regionLabel: 'Resumo executivo do risco',
      groups: {
        exposure: 'Exposição ao risco',
        response: 'Resposta',
        governance: 'Governança',
      },
      inherentLevel: {
        label: 'Nível inerente',
        hint: 'Antes dos controles',
        notAssessed: 'Não avaliado',
      },
      residualLevel: {
        label: 'Nível residual',
        hint: 'Após os controles',
        notAssessed: 'Não avaliado',
      },
      treatment: {
        label: 'Tratamento',
        notDefined: 'Não definido',
      },
      actionPlans: {
        label: 'Planos de ação',
        none: 'Não possui',
        hint: (open: number, overdue: number): string =>
          `${open} ${open === 1 ? 'aberto' : 'abertos'} · ${overdue} em atraso`,
      },
      review: {
        label: 'Revisão',
        none: 'Não agendada',
        hintOnTime: 'Próxima revisão',
        hintOverdue: 'Em atraso',
      },
    },

    lifecycleSpine: {
      title: 'Trajetória do ciclo de vida',
      mainAriaLabel: 'Posições principais do ciclo de vida',
      branchesAriaLabel: 'Ramos do ciclo de vida',
      branchesLabel: 'Ramos',
      stateLabels: {
        current: 'Atual',
        traversed: 'Concluído',
        available: 'Disponível',
        blocked: 'Bloqueado',
        unavailable: 'Indisponível',
      },
    },

    attention: {
      heading: 'Atenção',
      pendingApproval: (transitionLabel: string): string =>
        `Aprovação pendente: ${transitionLabel}`,
      overdueReview: 'Revisão vencida.',
      overdueTreatment: 'Há ações de tratamento em atraso.',
      blockedTransition: (targetLabel: string): string =>
        `Transição para "${targetLabel}" bloqueada`,
    },

    quickActions: {
      heading: 'Ações rápidas',
      recordAssessment: 'Registrar avaliação',
      recordTreatmentDecision: 'Registrar decisão de tratamento',
      createActionPlan: 'Criar plano de ação',
      linkControl: 'Vincular controle',
      addEvidence: 'Adicionar evidência',
      comment: 'Comentar',
    },

    relationshipsPanel: {
      heading: 'Relacionamentos',
      actionPlans: (count: number): string => `Planos de ação (${count})`,
      controls: (count: number): string => `Controles (${count})`,
      processesAssets: (count: number): string => `Processos e Ativos (${count})`,
      incidents: 'Incidentes',
      problems: 'Problemas',
      evidence: 'Evidências',
      findings: 'Achados (da unidade organizacional)',
      viewHint: 'Ver',
    },

    lastUpdatedHeading: 'Última atualização',
  },

  overview: {
    cardTitle: 'Dados do risco',
    descriptionCardTitle: 'Descrição',
    detailsCardTitle: 'Detalhes do risco',
    fields: {
      description: 'Descrição',
      category: 'Categoria',
      type: 'Tipo',
      origin: 'Origem',
      orgUnit: 'Unidade organizacional',
      owner: 'Gestor do risco',
      responsible: 'Responsável',
      identifiedOn: 'Data de identificação',
      lastAssessedOn: 'Última avaliação',
      nextReviewOn: 'Próxima revisão',
      status: 'Status',
    },
    notSet: 'Não definido',
  },

  register: {
    pageTitle: 'Registro de riscos',
    pageDescription: 'Gerencie, filtre e acompanhe os riscos do seu escopo organizacional.',
    tableCaption: 'Registro de riscos',
    createAction: 'Novo risco',
    loadError: 'Não foi possível carregar o registro de riscos.',

    filters: {
      regionLabel: 'Filtros do registro de riscos',
      groupLabel: 'Filtros',
      searchLabel: 'Buscar por código, título ou descrição',
      searchPlaceholder: 'Buscar riscos por código, título ou descrição…',
      statusLabel: 'Status',
      riskLevelLabel: 'Nível de risco',
      basisLabel: 'Base do nível exibido',
      basisLabelShort: 'Base',
      basisOptions: {
        RESIDUAL: 'Residual',
        INHERENT: 'Inerente',
      },
      categoryLabel: 'Categoria',
      orgUnitLabel: 'Unidade organizacional',
      ownerLabel: 'Gestor do risco',
      overdueReviewLabel: 'Revisão vencida',
      overdueTreatmentLabel: 'Tratamento vencido',
      loadingOptions: 'Carregando opções de filtro…',
      optionsError: 'Não foi possível carregar as opções de filtro.',
      columnsMenuLabel: 'Colunas',
    },

    columns: {
      code: 'Código',
      title: 'Título',
      status: 'Status',
      category: 'Categoria',
      orgUnit: 'Unidade organizacional',
      owner: 'Gestor do risco',
      riskLevelBasisSuffix: {
        RESIDUAL: 'residual',
        INHERENT: 'inerente',
      },
      nextReviewOn: 'Próxima revisão',
      identifiedOn: 'Identificado em',
      lastAssessedOn: 'Última avaliação',
      updatedAt: 'Atualizado em',
      notSet: 'Não definido',
    },

    indicators: {
      overdueReview: 'Revisão vencida',
      overdueTreatment: 'Tratamento vencido',
      treatmentOnTime: 'Em dia',
      pendingApproval: PENDING_APPROVAL_LABEL,
    },

    summary: {
      regionLabel: 'Situação geral dos riscos no seu escopo',
      total: {
        label: 'Total de riscos',
        hint: 'No seu escopo organizacional',
        linkLabel: 'Ver todos os riscos, sem filtros',
      },
      critical: {
        label: 'Riscos críticos',
        hint: 'Nível residual crítico',
        linkLabel: 'Filtrar o registro por nível residual crítico',
      },
      underTreatment: {
        label: 'Em tratamento',
        hint: 'Com tratamento em andamento',
        linkLabel: 'Filtrar o registro por status em tratamento',
      },
      overdueReview: {
        label: 'Revisão vencida',
        hint: 'Próxima revisão já no passado',
        linkLabel: 'Filtrar o registro por revisão vencida',
      },
      loading: 'Carregando indicadores…',
      error: 'Não foi possível carregar os indicadores.',
    },

    view: {
      groupLabel: 'Modo de visualização',
      cards: 'Cards',
      table: 'Tabela',
      cardsLabel: 'Ver os riscos em cards',
      tableLabel: 'Ver os riscos em tabela',
    },

    results: {
      count: (total: number): string =>
        total === 1 ? '1 risco' : `${total.toLocaleString('pt-BR')} riscos`,
      countLoading: 'Carregando riscos…',
      sortLabel: 'Ordenar por',
      sortOptions: {
        'code:asc': 'Código (crescente)',
        'updatedAt:desc': 'Mais recentes',
        'title:asc': 'Título (A–Z)',
        'riskLevel:desc': 'Maior nível de risco',
        'nextReviewOn:asc': 'Próxima revisão',
        'status:asc': 'Status',
        'owner:asc': 'Gestor do risco',
      },
      sortFieldLabels: {
        code: 'Código',
        title: 'Título',
        riskLevel: 'Nível de risco',
        status: 'Status',
        owner: 'Gestor do risco',
        nextReviewOn: 'Próxima revisão',
        identifiedOn: 'Identificado em',
        updatedAt: 'Atualizado em',
      },
      sortDirectionLabels: {
        asc: 'crescente',
        desc: 'decrescente',
      },
      customSortOption: (fieldLabel: string, directionLabel: string): string =>
        `${fieldLabel} (${directionLabel})`,
    },

    card: {
      regionLabel: 'Riscos',
      categoryLabel: 'Categoria',
      orgUnitLabel: 'Unidade',
      ownerLabel: 'Gestor',
      updatedAt: (date: string): string => `Atualizado em ${date}`,
      selectLabel: (code: string, title: string): string => `Abrir o risco ${code}: ${title}`,
      noLevel: 'Sem avaliação',
    },

    activeFilters: {
      regionLabel: 'Filtros ativos',
      searchChip: (value: string): string => `Busca: "${value}"`,
      countChip: (label: string, count: number): string => `${label} (${count})`,
      valueChip: (label: string, value: string): string => `${label}: ${value}`,
      removeLabel: (label: string): string => `Remover filtro: ${label}`,
    },

    empty: {
      noneYet: {
        title: 'Nenhum risco cadastrado ainda',
        description: 'Quando um risco for criado, ele aparecerá aqui.',
        createAction: 'Criar o primeiro risco',
      },
      noResults: {
        title: 'Nenhum risco encontrado para os filtros aplicados',
        description: 'Tente ajustar ou limpar os filtros e o termo de busca.',
        clearAction: 'Limpar todos os filtros',
      },
    },
  },

  assessment: {
    form: {
      cardTitle: 'Nova avaliação',
      cardDescription:
        'Registre a probabilidade e o impacto inerentes e residuais. Pontuação e nível são calculados pela metodologia configurada — nunca digitados aqui.',
      loadingMethodology: 'Carregando metodologia de avaliação…',
      methodologyError: 'Não foi possível carregar a metodologia de avaliação de risco.',

      basisToggle: {
        groupLabel: 'Selecionando',
        inherentAction: 'Risco inerente',
        residualAction: 'Risco residual',
      },

      sections: {
        inherent: {
          title: 'Risco inerente',
          description: 'Probabilidade e impacto antes de considerar os controles em vigor.',
        },
        residual: {
          title: 'Risco residual',
          description: 'Probabilidade e impacto depois de considerar os controles em vigor.',
        },
      },

      matrixLabels: (activeBasis: 'inherent' | 'residual') =>
        buildRiskMatrixLabels(
          activeBasis === 'inherent'
            ? 'Matriz de risco — selecionando risco inerente'
            : 'Matriz de risco — selecionando risco residual',
        ),

      selectionSummary: (
        basisLabel: string,
        selection: { score: number; levelLabel: string } | null,
      ): string =>
        selection
          ? `${basisLabel}: pontuação ${selection.score}, nível ${selection.levelLabel}.`
          : `${basisLabel}: ainda não selecionado.`,

      fields: {
        rationale: {
          label: 'Justificativa',
          description: 'Explique o que embasou os valores escolhidos, se relevante.',
        },
      },

      validation: {
        inherentCellRequired: 'Selecione a probabilidade e o impacto do risco inerente.',
        residualCellRequired: 'Selecione a probabilidade e o impacto do risco residual.',
      },

      actions: {
        submit: 'Registrar avaliação',
        submitting: 'Registrando…',
      },

      submitSuccess: 'Avaliação registrada.',
      genericError: 'Não foi possível registrar a avaliação. Tente novamente.',

      methodologyChanged: {
        title: 'A metodologia de avaliação foi atualizada',
        description:
          'A versão da metodologia usada neste formulário não é mais a vigente. Recarregue a metodologia abaixo e refaça as seleções antes de registrar a avaliação.',
        reloadAction: 'Recarregar metodologia vigente',
      },

      conflict: {
        title: 'Este risco foi alterado por outra pessoa',
        description:
          'Alguém salvou uma alteração neste risco enquanto você preenchia esta avaliação. Sua avaliação abaixo NÃO foi perdida e continua preenchida neste formulário, mas ainda não foi registrada — revise o que mudou antes de tentar novamente.',
        modifiedBy: (name: string): string => `Alterado por: ${name}`,
        modifiedAt: (when: string): string => `Alterado em: ${when}`,
        reloadAction: 'Ver versão atual em nova aba',
        retryAction: 'Registrar mesmo assim com minha avaliação',
        dismissAction: 'Continuar editando',
      },
    },

    causesConsequencesSummary: {
      causesHeading: 'Causas',
      consequencesHeading: 'Consequências',
      empty: 'Nenhuma registrada.',
      andMore: (count: number): string => `+ ${count} ${count === 1 ? 'outra' : 'outras'}`,
      viewAllAction: 'Ver Causas e Consequências completas',
    },

    actions: {
      recordNew: 'Registrar nova avaliação',
      changeNextReview: 'Alterar próxima revisão',
    },

    section: {
      cardTitle: 'Avaliação atual',
      notAssessedTitle: 'Este risco ainda não foi avaliado',
      notAssessedDescription: 'Registre a primeira avaliação abaixo para calcular seus níveis.',
      inherentTitle: 'Risco inerente',
      residualTitle: 'Risco residual',
      assessedOn: (date: string): string => `Avaliado em ${date}`,
      assessedBy: (name: string): string => `Avaliado por ${name}`,
      methodologyVersion: (versionNumber: number): string => `Metodologia v${versionNumber}`,
      assessedOnFieldLabel: 'Avaliado em',
      assessedByFieldLabel: 'Avaliado por',
      methodologyFieldLabel: 'Metodologia',
      rationaleLabel: 'Justificativa',
      noRationale: 'Nenhuma justificativa registrada.',
      matrixCaption: 'Matriz de risco — avaliação atual em contexto',
      matrixLoading: 'Carregando matriz de risco…',
      matrixLoadError:
        'Não foi possível carregar a matriz de risco para exibir a avaliação em contexto.',
      comparison: {
        probabilityLabel: 'Probabilidade',
        impactLabel: 'Impacto',
      },
      contextHeading: 'Contexto da avaliação',
    },

    history: {
      cardTitle: 'Histórico de avaliações',
      cardDescription:
        'Cada avaliação é um registro permanente e individual; uma reavaliação nunca substitui ou apaga as anteriores.',
      loading: 'Carregando histórico de avaliações…',
      loadError: 'Não foi possível carregar o histórico de avaliações.',
      empty: 'Nenhuma avaliação registrada ainda.',
      columns: {
        assessedOn: 'Data',
        assessedBy: 'Avaliado por',
        inherent: 'Inerente',
        residual: 'Residual',
        change: 'Variação do nível residual',
        rationale: 'Justificativa',
      },
      change: {
        first: 'Primeira avaliação registrada — sem avaliação anterior para comparar.',
        increased: (previousLevel: string, currentLevel: string): string =>
          `Subiu de ${previousLevel} para ${currentLevel}.`,
        decreased: (previousLevel: string, currentLevel: string): string =>
          `Caiu de ${previousLevel} para ${currentLevel}.`,
        unchanged: (level: string): string => `Permaneceu em ${level}.`,
      },
      noRationale: 'Sem justificativa registrada.',
      loadMore: 'Carregar mais',
    },

    reviewSchedule: {
      cardTitle: 'Próxima revisão',
      currentLabel: 'Data agendada',
      notSet: 'Não definida',
      overdueLabel: 'Revisão vencida',
      fieldLabel: 'Nova data de próxima revisão',
      saveAction: 'Salvar',
      saving: 'Salvando…',
      saveSuccess: 'Próxima revisão atualizada.',
      saveError: 'Não foi possível atualizar a próxima revisão. Tente novamente.',
    },
  },

  treatment: {
    strategyLabels: TREATMENT_STRATEGY_LABELS,

    section: {
      cardTitle: 'Tratamento atual',
      notTreatedTitle: 'Este risco ainda não possui uma decisão de tratamento',
      notTreatedDescription: 'Registre a estratégia de tratamento abaixo.',
      fields: {
        strategy: 'Estratégia',
        description: 'Descrição',
        deadline: 'Prazo',
        decidedBy: (name: string): string => `Decidido por ${name}`,
        decidedAt: (date: string): string => `Decidido em ${date}`,
      },
      noDeadline: 'Sem prazo definido.',
      deadlineOverdueLabel: 'Prazo vencido',
      recordNewAction: 'Registrar nova decisão',
    },

    form: {
      cardTitle: 'Registrar decisão de tratamento',
      cardDescription:
        'Defina a estratégia de tratamento deste risco. Se já existir uma decisão vigente, registrar uma nova decisão a substitui — a anterior permanece visível no histórico, mas deixa de ser a decisão vigente.',
      supersessionWarning: (currentStrategyLabel: string): string =>
        `Este risco já possui uma decisão vigente (${currentStrategyLabel}). Registrar esta nova decisão irá substituí-la como decisão vigente — a decisão atual NÃO será apagada e continuará visível no histórico abaixo.`,
      fields: {
        strategy: { label: 'Estratégia', placeholder: 'Selecione a estratégia de tratamento' },
        description: {
          label: 'Descrição',
          description: 'A justificativa para esta decisão de tratamento.',
        },
        deadline: { label: 'Prazo' },
      },
      validation: {
        strategyRequired: 'Selecione a estratégia de tratamento.',
        descriptionRequired: 'Descreva a justificativa desta decisão.',
      },
      actions: {
        submit: 'Registrar decisão',
        submitting: 'Registrando…',
        cancel: 'Cancelar',
      },
      submitSuccess: 'Decisão de tratamento registrada.',
      genericError: 'Não foi possível registrar a decisão de tratamento. Tente novamente.',
      conflict: {
        title: 'Este risco foi alterado por outra pessoa',
        description:
          'Alguém salvou uma alteração neste risco enquanto você preenchia esta decisão. Sua decisão abaixo NÃO foi perdida e continua preenchida neste formulário, mas ainda não foi registrada — revise o que mudou antes de tentar novamente.',
        modifiedBy: (name: string): string => `Alterado por: ${name}`,
        modifiedAt: (when: string): string => `Alterado em: ${when}`,
        reloadAction: 'Ver versão atual em nova aba',
        retryAction: 'Registrar mesmo assim com minha decisão',
        dismissAction: 'Continuar editando',
      },
    },

    history: {
      cardTitle: 'Histórico de decisões de tratamento',
      cardDescription:
        'Cada decisão é um registro permanente; registrar uma nova decisão nunca apaga ou substitui as anteriores no histórico.',
      loading: 'Carregando histórico de tratamento…',
      loadError: 'Não foi possível carregar o histórico de tratamento.',
      empty: 'Nenhuma decisão de tratamento registrada ainda.',
      columns: {
        strategy: 'Estratégia',
        description: 'Descrição',
        deadline: 'Prazo',
        decidedBy: 'Decidido por',
        decidedAt: 'Decidido em',
        status: 'Situação',
      },
      currentBadge: 'Vigente',
      supersededBadge: (date: string): string => `Substituída em ${date}`,
      loadMore: 'Carregar mais',
    },

    actionsTable: {
      cardTitle: 'Plano de ação',
      cardDescription: 'Ações de tratamento que implementam a decisão de tratamento deste risco.',
      loading: 'Carregando plano de ação…',
      loadError: 'Não foi possível carregar o plano de ação.',
      empty: 'Nenhuma ação de tratamento registrada ainda.',
      columns: {
        title: 'Título',
        responsible: 'Responsável',
        dueOn: 'Prazo',
        status: 'Situação',
        rowActions: 'Ações',
      },
      overdueBadge: 'Vencida',
      addAction: 'Adicionar ação',
      editAction: 'Editar',
      loadMore: 'Carregar mais',
      transitionError: 'Não foi possível alterar a situação da ação. Tente novamente.',

      summary: {
        total: (count: number): string => `${count} ${count === 1 ? 'ação' : 'ações'} no total`,
        overdue: (count: number): string =>
          count === 0 ? 'Nenhuma atrasada' : `${count} ${count === 1 ? 'atrasada' : 'atrasadas'}`,
      },

      form: {
        cardTitle: 'Nova ação de tratamento',
        fields: {
          title: { label: 'Título' },
          description: { label: 'Descrição' },
          responsible: { label: 'Responsável', placeholder: 'Selecione o responsável' },
          dueOn: { label: 'Prazo' },
        },
        validation: {
          titleRequired: 'Informe o título da ação.',
          responsibleRequired: 'Selecione o responsável pela ação.',
          dueOnRequired: 'Informe o prazo da ação.',
        },
        actions: {
          submit: 'Adicionar ação',
          submitting: 'Adicionando…',
          cancel: 'Cancelar',
        },
        submitSuccess: 'Ação de tratamento adicionada.',
        genericError: 'Não foi possível adicionar a ação de tratamento. Tente novamente.',
      },

      editForm: {
        cardTitle: 'Editar ação de tratamento',
        fields: {
          title: { label: 'Título' },
          description: { label: 'Descrição' },
          responsible: { label: 'Responsável', placeholder: 'Selecione o responsável' },
          dueOn: { label: 'Prazo' },
        },
        validation: {
          titleRequired: 'Informe o título da ação.',
          responsibleRequired: 'Selecione o responsável pela ação.',
          dueOnRequired: 'Informe o prazo da ação.',
        },
        actions: {
          submit: 'Salvar',
          submitting: 'Salvando…',
          cancel: 'Cancelar',
        },
        submitSuccess: 'Ação de tratamento atualizada.',
        genericError: 'Não foi possível atualizar a ação de tratamento. Tente novamente.',
      },

      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    actionsMovedNotice: 'As ações desta decisão de tratamento estão na aba "Planos de Ação".',
  },

  relationships: {
    controls: {
      sectionTitle: 'Controles',
      sectionDescription: 'Controles associados que influenciam o risco residual.',
      entityLabel: 'controle',
      pickerLabel: 'Vincular controle',
      pickerPlaceholder: 'Selecione um controle',
      pickerNoOptions: 'Nenhum controle disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar controle por nome ou código',
      pickerAriaLabel: 'Selecionar controle',
      empty: 'Nenhum controle vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Controle vinculado.',
      unlinkSuccess: 'Controle desvinculado.',
      linkError: 'Não foi possível vincular o controle. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o controle. Tente novamente.',
      alreadyLinkedError: 'Este controle já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular controle?',
        description: (name: string): string =>
          `O controle "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico, com data e responsável pela remoção — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Controle',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    processes: {
      sectionTitle: 'Processos',
      sectionDescription: 'Processos de negócio relacionados a este risco.',
      entityLabel: 'processo',
      pickerLabel: 'Vincular processo',
      pickerPlaceholder: 'Selecione um processo',
      pickerNoOptions: 'Nenhum processo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar processo por nome ou código',
      pickerAriaLabel: 'Selecionar processo',
      empty: 'Nenhum processo vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Processo vinculado.',
      unlinkSuccess: 'Processo desvinculado.',
      linkError: 'Não foi possível vincular o processo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o processo. Tente novamente.',
      alreadyLinkedError: 'Este processo já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular processo?',
        description: (name: string): string =>
          `O processo "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Processo',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    assets: {
      sectionTitle: 'Ativos',
      sectionDescription: 'Ativos relacionados a este risco.',
      entityLabel: 'ativo',
      pickerLabel: 'Vincular ativo',
      pickerPlaceholder: 'Selecione um ativo',
      pickerNoOptions: 'Nenhum ativo disponível para vincular.',
      pickerSearchPlaceholder: 'Buscar ativo por nome ou código',
      pickerAriaLabel: 'Selecionar ativo',
      empty: 'Nenhum ativo vinculado a este risco.',
      linkAction: 'Vincular',
      unlinkAction: 'Desvincular',
      linkSuccess: 'Ativo vinculado.',
      unlinkSuccess: 'Ativo desvinculado.',
      linkError: 'Não foi possível vincular o ativo. Tente novamente.',
      unlinkError: 'Não foi possível desvincular o ativo. Tente novamente.',
      alreadyLinkedError: 'Este ativo já está vinculado a este risco.',
      unlinkConfirm: {
        title: 'Desvincular ativo?',
        description: (name: string): string =>
          `O ativo "${name}" será desvinculado deste risco. O vínculo não é apagado: ele continua registrado no histórico — apenas deixa de contar como um vínculo vigente.`,
      },
      columns: {
        name: 'Ativo',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    conflictError:
      'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    incidents: {
      sectionTitle: 'Incidentes',
      sectionDescription:
        'Incidentes que referenciam este risco. Vincular ou desvincular acontece a partir do incidente.',
      empty: 'Nenhum incidente vinculado a este risco.',
      loading: 'Carregando incidentes vinculados…',
      loadError: 'Não foi possível carregar os incidentes vinculados a este risco.',
      statusLabels: {
        OPEN: 'Aberto',
        IN_PROGRESS: 'Em andamento',
        RESOLVED: 'Resolvido',
        CLOSED: 'Fechado',
        CANCELLED: 'Cancelado',
      } satisfies Record<IncidentStatusRef, string>,
      columns: {
        incident: 'Incidente',
        status: 'Status',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
    problems: {
      sectionTitle: 'Problemas',
      sectionDescription:
        'Problemas que referenciam este risco. Vincular ou desvincular acontece a partir do problema.',
      empty: 'Nenhum problema vinculado a este risco.',
      loading: 'Carregando problemas vinculados…',
      loadError: 'Não foi possível carregar os problemas vinculados a este risco.',
      statusLabels: {
        OPEN: 'Aberto',
        IN_ANALYSIS: 'Em análise',
        RESOLVED: 'Resolvido',
        CLOSED: 'Fechado',
        CANCELLED: 'Cancelado',
      } satisfies Record<ProblemStatusRef, string>,
      columns: {
        problem: 'Problema',
        status: 'Status',
        linkedBy: 'Vinculado por',
        linkedAt: 'Vinculado em',
      },
    },
  },

  lifecycle: {
    cardTitle: 'Ciclo de vida',
    cardDescription: 'Transições disponíveis a partir do status atual, para o seu perfil.',
    loading: 'Carregando transições disponíveis…',
    loadError: 'Não foi possível carregar as transições disponíveis.',
    noneAvailable: 'Nenhuma transição está disponível para o seu perfil neste momento.',
    unmetPreconditionsTitle: 'Pendências para esta transição:',

    actions: {
      apply: (targetLabel: string): string => `Aplicar: ${targetLabel}`,
      requestApproval: (targetLabel: string): string => `Solicitar aprovação: ${targetLabel}`,
      authorizedFor: (requiredPermission: string): string => {
        const phrases: Readonly<Record<string, string>> = {
          'risk:edit': 'Disponível para usuários autorizados a editar riscos neste escopo.',
          'risk:assess': 'Disponível para usuários autorizados a avaliar riscos neste escopo.',
          'risk:treat':
            'Disponível para usuários autorizados a definir o tratamento do risco neste escopo.',
          'risk:transition':
            'Disponível para usuários autorizados a conduzir o ciclo de vida do risco neste escopo.',
          'risk:administer': 'Disponível apenas para administradores da plataforma.',
        };
        return phrases[requiredPermission] ?? 'Disponível para usuários autorizados neste escopo.';
      },
      requiresApprovalNotice: 'Esta transição exige aprovação por outro usuário autorizado.',
    },

    transitionDialog: {
      title: (targetLabel: string): string => `Aplicar transição para "${targetLabel}"`,
      description: (targetLabel: string): string =>
        `O risco mudará para "${targetLabel}" imediatamente ao confirmar. Esta transição é registrada no histórico do risco.`,
      justificationLabel: 'Justificativa',
      justificationDescription: 'Registrada junto com a transição, para referência futura.',
      confirmAction: 'Confirmar transição',
      confirmingAction: 'Aplicando…',
      cancelAction: 'Cancelar',
      submitSuccess: (targetLabel: string): string => `Risco transicionado para ${targetLabel}.`,
      genericError: 'Não foi possível aplicar a transição. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    pendingApproval: {
      cardTitle: 'Aprovação pendente',
      requestedBy: (name: string): string => `Solicitado por ${name}`,
      requestedAt: (date: string): string => `em ${date}`,
      transitionLabel: (targetLabel: string): string => `Transição solicitada: para ${targetLabel}`,
      justificationLabel: 'Justificativa da solicitação',
      noJustification: 'Nenhuma justificativa informada.',
      selfRequestNotice:
        'Você fez esta solicitação. Por segregação de funções, a decisão precisa ser tomada por outra pessoa com permissão para aprovar.',
      approveAction: 'Aprovar',
      rejectAction: 'Rejeitar',
    },

    requestApprovalDialog: {
      title: (targetLabel: string): string => `Solicitar aprovação para "${targetLabel}"`,
      description: (targetLabel: string): string =>
        `Esta transição exige a decisão de outra pessoa antes de ser aplicada. O risco permanece em seu status atual até que a solicitação seja aprovada ou rejeitada (para: ${targetLabel}).`,
      justificationLabel: 'Justificativa',
      justificationDescription: 'Explique por que esta transição deve ser aprovada.',
      confirmAction: 'Solicitar aprovação',
      confirmingAction: 'Enviando…',
      cancelAction: 'Cancelar',
      submitSuccess: 'Solicitação de aprovação enviada.',
      genericError: 'Não foi possível solicitar a aprovação. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    decisionDialog: {
      title: {
        APPROVED: 'Aprovar transição',
        REJECTED: 'Rejeitar transição',
      },
      description: (params: {
        requestedByName: string;
        requestedAtLabel: string;
        transitionLabel: string;
      }): string =>
        `Solicitado por ${params.requestedByName} em ${params.requestedAtLabel}, para: ${params.transitionLabel}.`,
      permanentNotice: 'Esta decisão é registrada permanentemente e não poderá ser desfeita.',
      justificationLabel: {
        APPROVED: 'Justificativa',
        REJECTED: 'Justificativa',
      },
      justificationRequiredForRejection: 'Informe a justificativa da rejeição.',
      confirmAction: {
        APPROVED: 'Confirmar aprovação',
        REJECTED: 'Confirmar rejeição',
      },
      confirmingAction: 'Registrando…',
      cancelAction: 'Cancelar',
      submitSuccess: {
        APPROVED: 'Aprovação registrada. A transição foi aplicada.',
        REJECTED: 'Rejeição registrada.',
      },
      genericError: 'Não foi possível registrar a decisão. Tente novamente.',
      conflictError:
        'Este risco foi alterado por outra pessoa. Recarregue a página para ver a versão atual antes de continuar.',
    },

    pendingApprovalBadge: {
      label: PENDING_APPROVAL_LABEL,
    },
  },

  history: {
    cardTitle: 'Histórico do risco',
    cardDescription:
      'Linha do tempo única com avaliações, decisões de tratamento, transições de status, aprovações e alterações de responsável — cada evento mostra quem agiu e quando.',
    caption: 'Histórico do risco',
    loading: 'Carregando histórico…',
    loadError: 'Não foi possível carregar o histórico do risco.',
    empty: 'Nenhum evento registrado ainda.',
    recordedAtLabel: 'Registrado em',
    assertedDateLabel: 'Data informada',
    previousValueLabel: 'Anterior',
    newValueLabel: 'Novo',
    loadMoreLabel: 'Carregar mais',
    loadingMoreLabel: 'Carregando mais…',
    typeLabels: RISK_HISTORY_ENTRY_TYPE_LABELS,
    filter: {
      label: 'Tipo de evento',
    },
  },

  audit: {
    cardTitle: 'Trilha de auditoria',
    cardDescription:
      'Registro completo e imutável de eventos deste risco — quem, quando, o quê e o resultado de cada ação. Nenhum evento pode ser alterado ou excluído.',
    caption: 'Trilha de auditoria',
    loading: 'Carregando trilha de auditoria…',
    loadError: 'Não foi possível carregar a trilha de auditoria.',
    empty: 'Nenhum evento de auditoria registrado ainda.',
    occurredAtLabel: 'Ocorrido em',
    actorLabel: 'Ator',
    entityLabel: 'Entidade',
    notRecordedLabel: 'Não registrado',
    emptyCollectionLabel: 'Nenhum',
    changedFieldsLabel: 'Campos alterados',
    ipAddressLabel: 'Endereço IP',
    userAgentLabel: 'Navegador/dispositivo',
    correlationIdLabel: 'ID de correlação',
    loadMoreLabel: 'Carregar mais',
    loadingMoreLabel: 'Carregando mais…',
    outcomeLabel: (outcome: string): string =>
      AUDIT_OUTCOME_LABELS[outcome as AuditOutcome] ?? outcome,
    outcomeVariant: auditOutcomeVariant,
    fieldLabel: auditFieldLabel,
    unresolvedReference: (id: string): string => `Registro não encontrado (${id})`,
    buildValueResolver: buildAuditValueResolver,
    forbidden: {
      title: 'Sem permissão para ver a trilha de auditoria',
      detail:
        'Você pode ver este risco, mas não tem a permissão necessária para ver sua trilha de auditoria. Se isso não for esperado, procure um administrador.',
    },
  },

  comments: {
    cardTitle: 'Comentários',
    cardDescription:
      'Observações registradas por quem tem acesso a este risco. Um comentário removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Comentários do risco',
    loading: 'Carregando comentários…',
    loadError: 'Não foi possível carregar os comentários.',
    empty: 'Nenhum comentário registrado ainda.',
    composerLabel: 'Novo comentário',
    composerPlaceholder: 'Escreva um comentário sobre este risco…',
    submitLabel: 'Comentar',
    submittingLabel: 'Enviando…',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais comentários',
    loadingMoreLabel: 'Carregando mais comentários…',
    submitSuccess: 'Comentário adicionado.',
    submitError: 'Não foi possível adicionar o comentário. Tente novamente.',
    withdrawConfirm: {
      title: 'Remover comentário?',
      description:
        'O comentário não é apagado: ele deixa de aparecer nesta lista, mas continua registrado na trilha de auditoria, com autoria e data preservadas.',
    },
    withdrawSuccess: 'Comentário removido.',
    withdrawError: 'Não foi possível remover o comentário. Tente novamente.',
  },

  attachments: {
    cardTitle: 'Anexos',
    cardDescription:
      'Evidências e documentos anexados a este risco. Um anexo removido deixa de aparecer aqui, mas permanece na trilha de auditoria.',
    caption: 'Anexos do risco',
    loading: 'Carregando anexos…',
    loadError: 'Não foi possível carregar os anexos.',
    empty: 'Nenhum anexo enviado ainda.',
    chooseFileLabel: 'Selecionar arquivo',
    uploadLabel: 'Enviar arquivo',
    uploadingLabel: 'Enviando…',
    allowedTypesHint:
      'Formatos aceitos: PDF, PNG, JPEG ou texto simples (.txt). Tamanho máximo: 25 MB. O conteúdo do arquivo é conferido pelo servidor — um arquivo com a extensão trocada é recusado.',
    downloadLabel: 'Baixar anexo',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais anexos',
    loadingMoreLabel: 'Carregando mais anexos…',
    uploadSuccess: 'Arquivo enviado.',
    uploadGenericError: 'Não foi possível enviar o arquivo. Tente novamente.',
    withdrawConfirm: {
      title: 'Remover anexo?',
      description: (fileName: string): string =>
        `O arquivo "${fileName}" não é apagado: ele deixa de aparecer nesta lista, mas continua registrado na trilha de auditoria, com autoria e data preservadas.`,
    },
    withdrawSuccess: 'Anexo removido.',
    withdrawError: 'Não foi possível remover o anexo. Tente novamente.',
  },

  validation: {
    title: {
      required: 'Informe o título do risco.',
      tooLong: 'O título deve ter no máximo 300 caracteres.',
    },
    description: {
      required: 'Informe a descrição do risco.',
    },
    orgUnit: {
      required: 'Selecione a unidade organizacional.',
    },
    owner: {
      required: 'Selecione o gestor do risco.',
    },
  },
} as const;
