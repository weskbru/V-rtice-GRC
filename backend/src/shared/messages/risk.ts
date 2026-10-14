import type { ApprovalStatus, RiskLevel, RiskStatus, TreatmentStrategy } from '@prisma/client';

export const risk = {
  businessContentLocked:
    'Não é possível editar o conteúdo de negócio de um risco encerrado ou arquivado.',
  draftIncomplete: {
    title: 'O título é obrigatório para o risco sair do rascunho.',
    description: 'A descrição é obrigatória para o risco sair do rascunho.',
    category: 'A categoria é obrigatória para o risco sair do rascunho.',
    orgUnit: 'A unidade organizacional é obrigatória para o risco sair do rascunho.',
    owner: 'O gestor do risco é obrigatório para o risco sair do rascunho.',
  },
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  ownerNotFound: 'Usuário gestor do risco não encontrado ou inativo.',
  responsibleNotFound: 'Usuário responsável não encontrado ou inativo.',
  ownerNotAssignable:
    'Usuário gestor do risco não pertence à linha organizacional da unidade do risco.',
  responsibleNotAssignable:
    'Usuário responsável não pertence à linha organizacional da unidade do risco.',
  ownerNotVisible:
    'Usuário gestor do risco não tem condições de visualizar riscos nesta unidade organizacional.',
  responsibleNotVisible:
    'Usuário responsável não tem condições de visualizar riscos nesta unidade organizacional.',
  categoryNotFound: 'Categoria de risco não encontrada ou inativa.',
  typeNotFound: 'Tipo de risco não encontrado ou inativo.',
  originNotFound: 'Origem de risco não encontrada ou inativa.',
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para atualizar um risco.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  versionConflict: 'O risco foi modificado por outro usuário. Recarregue e tente novamente.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  assessment: {
    probabilityOutOfScale: 'O valor de probabilidade informado não pertence à escala configurada.',
    impactOutOfScale: 'O valor de impacto informado não pertence à escala configurada.',
    methodologyVersionNotActive:
      'A versão da metodologia informada não é mais a versão ativa. Recarregue a avaliação e tente novamente.',
    assessedOnInFuture: 'A data da avaliação não pode ser no futuro.',
  },

  methodology: {
    noActiveMethodology: 'Nenhuma metodologia de risco ativa foi configurada.',
    invalidConfiguration: 'A configuração da metodologia de risco informada é inválida.',
    scaleEmpty: 'A escala não pode ser vazia.',
    scaleNotOrdered:
      'A escala deve estar ordenada de forma crescente por valor, sem valores repetidos.',
    matrixMissingCell:
      'A matriz de risco não cobre todas as combinações de probabilidade e impacto declaradas nas escalas.',
    matrixUnknownCell:
      'A matriz de risco contém uma célula fora dos valores declarados nas escalas.',
    matrixDuplicateCell: 'A matriz de risco contém uma célula duplicada.',
    bandsEmpty: 'As faixas de nível de risco não podem ser vazias.',
    bandsInvalidLevel: 'Uma faixa de nível de risco informa um nível de risco inválido.',
    bandsInvalidRange: 'Uma faixa de nível de risco tem o valor mínimo maior que o valor máximo.',
    bandsNotOrdered: 'As faixas de nível de risco devem estar ordenadas de forma crescente.',
    bandsOverlapOrGap: 'As faixas de nível de risco devem ser contíguas e não podem se sobrepor.',
    bandsCoverageMismatch:
      'As faixas de nível de risco devem cobrir integralmente a faixa de pontuação alcançável pela matriz.',
    matrixBandMismatch:
      'O nível declarado em uma célula da matriz não corresponde à faixa de nível de risco correspondente à sua pontuação.',
  },

  treatment: {
    decisionNotFound: 'A decisão de tratamento informada não foi encontrada para este risco.',
    controlNotFound:
      'O controle informado não existe, está inativo ou está fora do escopo do usuário.',
    controlAlreadyLinked: 'Este controle já está associado a este risco.',
    processNotFound: 'O processo informado não foi encontrado ou está inativo.',
    processAlreadyLinked: 'Este processo já está associado a este risco.',
    assetNotFound: 'O ativo informado não foi encontrado ou está inativo.',
    assetAlreadyLinked: 'Este ativo já está associado a este risco.',
  },

  lifecycle: {
    transitionNotAllowed:
      'Esta transição de status não é permitida a partir do status atual do risco.',
    transitionRequiresApproval:
      'Esta transição requer aprovação. Solicite-a pelo endpoint de aprovações.',
    transitionNotApprovalGated:
      'Esta transição não requer aprovação e não pode ser solicitada como uma aprovação.',
    preconditions: {
      draftFieldsIncomplete:
        'É necessário completar título, descrição, categoria, unidade organizacional e gestor para sair do rascunho.',
      hasAssessment: 'É necessário haver ao menos uma avaliação registrada para esta transição.',
      hasTreatmentDecision:
        'É necessário haver uma decisão de tratamento registrada para esta transição.',
      reassessedDuringReview:
        'É necessário registrar uma nova avaliação durante a revisão antes de retornar ao status avaliado.',
    },
    approvalAlreadyPending: 'Já existe uma aprovação pendente para este risco.',
    approvalAlreadyDecided: 'Esta aprovação já foi decidida e não pode ser alterada.',
    approvalSelfApproval:
      'O usuário que solicitou esta transição não pode decidir sua própria solicitação.',
    approvalNotFound: 'Aprovação não encontrada para este risco.',
    approvalTransitionNoLongerValid:
      'A transição solicitada não é mais válida a partir do status atual do risco.',
  },

  history: {
    levelLabels: {
      LOW: 'Baixo',
      MEDIUM: 'Médio',
      HIGH: 'Alto',
      CRITICAL: 'Crítico',
    } satisfies Record<RiskLevel, string>,
    statusLabels: {
      DRAFT: 'Rascunho',
      IDENTIFIED: 'Identificado',
      ASSESSED: 'Avaliado',
      UNDER_TREATMENT: 'Em tratamento',
      UNDER_REVIEW: 'Em revisão',
      ACCEPTED: 'Aceito',
      CLOSED: 'Encerrado',
      ARCHIVED: 'Arquivado',
    } satisfies Record<RiskStatus, string>,
    treatmentStrategyLabels: {
      MITIGATE: 'Mitigar',
      AVOID: 'Evitar',
      TRANSFER: 'Transferir',
      ACCEPT: 'Aceitar',
    } satisfies Record<TreatmentStrategy, string>,
    approvalStatusLabels: {
      PENDING: 'Pendente',
      APPROVED: 'Aprovada',
      REJECTED: 'Rejeitada',
    } satisfies Record<ApprovalStatus, string>,
    assessmentRecorded: (residualLabel: string, inherentLabel: string): string =>
      `Nova avaliação registrada — risco residual ${residualLabel}, risco inerente ${inherentLabel}.`,
    treatmentDecisionRecorded: (strategyLabel: string): string =>
      `Decisão de tratamento registrada: ${strategyLabel}.`,
    lifecycleTransitionOccurred: (fromLabel: string, toLabel: string): string =>
      `O risco transicionou de "${fromLabel}" para "${toLabel}".`,
    approvalRequested: (toLabel: string): string =>
      `Aprovação solicitada para a transição para "${toLabel}".`,
    approvalApproved: (toLabel: string): string =>
      `Aprovação concedida — transição para "${toLabel}" aplicada.`,
    approvalRejected: 'Aprovação rejeitada.',
    ownershipChanged: (previousName: string, newName: string): string =>
      `Gestor do risco alterado de ${previousName} para ${newName}.`,
    ownershipSet: (newName: string): string => `Gestor do risco definido como ${newName}.`,
  },

  dashboard: {
    reviewOverdueSince: (dateOnly: string): string => {
      const [year, month, day] = dateOnly.split('-');
      const formatted = year && month && day ? `${day}/${month}/${year}` : dateOnly;
      return `Revisão vencida desde ${formatted}.`;
    },
  },

  evidenceSubject: {
    riskLabel: (code: string, title: string): string => `${code} — ${title}`,
    treatmentDecisionLabel: (riskCode: string, strategyLabel: string): string =>
      `Decisão de tratamento (${strategyLabel}) — ${riskCode}`,
  },
} as const;

export const riskFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  categoryId: { isUuid: 'A categoria informada é inválida.' },
  typeId: { isUuid: 'O tipo informado é inválido.' },
  originId: { isUuid: 'A origem informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O gestor do risco informado é inválido.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
  nextReviewOn: { isDateString: 'A data da próxima revisão informada é inválida.' },
  causes: {
    isString: 'Cada causa deve ser um texto.',
    minLength: 'A causa não pode ser vazia.',
  },
  consequences: {
    isString: 'Cada consequência deve ser um texto.',
    minLength: 'A consequência não pode ser vazia.',
  },
} as const;

export const riskStatementItems = {
  isArray: 'A lista de itens é obrigatória.',
  isString: 'Cada item deve ser um texto.',
  minLength: 'O item não pode ser vazio.',
  arrayMaxSize: 'A lista pode ter no máximo 50 itens.',
} as const;

export const assessment = {
  assessedOn: { isDateString: 'A data da avaliação informada é inválida.' },
  inherentProbability: { isInt: 'A probabilidade inerente informada é inválida.' },
  inherentImpact: { isInt: 'O impacto inerente informado é inválido.' },
  residualProbability: { isInt: 'A probabilidade residual informada é inválida.' },
  residualImpact: { isInt: 'O impacto residual informado é inválido.' },
  controlIdsConsidered: { isUuid: 'Um dos controles informados é inválido.' },
  rationale: { isString: 'A justificativa deve ser um texto.' },
  methodologyVersionId: { isUuid: 'A versão de metodologia informada é inválida.' },
  nextReviewOn: { isDateString: 'A data da próxima revisão informada é inválida.' },
} as const;

export const pageQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

export const methodology = {
  probabilityScale: { arrayMinSize: 'A escala de probabilidade deve ter ao menos 2 valores.' },
  impactScale: { arrayMinSize: 'A escala de impacto deve ter ao menos 2 valores.' },
  matrix: { arrayMinSize: 'A matriz de risco deve ter ao menos 4 células.' },
  levelBands: { arrayMinSize: 'As faixas de nível de risco devem ter ao menos 2 faixas.' },
  effectiveFrom: { isDateString: 'A data de vigência informada é inválida.' },
  scalePoint: {
    value: { isInt: 'O valor do ponto de escala informado é inválido.' },
    label: { isString: 'O rótulo do ponto de escala deve ser um texto.' },
  },
  matrixCell: {
    probability: { isInt: 'A probabilidade da célula da matriz informada é inválida.' },
    impact: { isInt: 'O impacto da célula da matriz informado é inválido.' },
    score: { isInt: 'A pontuação da célula da matriz informada é inválida.' },
    level: { isIn: 'O nível de risco da célula da matriz informado é inválido.' },
  },
  levelBand: {
    level: { isIn: 'O nível de risco da faixa informado é inválido.' },
    minScore: { isInt: 'A pontuação mínima da faixa informada é inválida.' },
    maxScore: { isInt: 'A pontuação máxima da faixa informada é inválida.' },
  },
} as const;

export const referenceDataQuery = {
  includeInactive: { isBoolean: 'O parâmetro includeInactive deve ser verdadeiro ou falso.' },
} as const;

export const treatmentDecision = {
  strategy: { isIn: 'A estratégia de tratamento informada é inválida.' },
  description: {
    isString: 'A descrição/justificativa deve ser um texto.',
    minLength: 'A descrição/justificativa não pode ser vazia.',
  },
  deadline: { isDateString: 'O prazo informado é inválido.' },
} as const;

export const treatmentAction = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: { isString: 'A descrição deve ser um texto.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  dueOn: { isDateString: 'A data de vencimento informada é inválida.' },
  treatmentDecisionId: { isUuid: 'A decisão de tratamento informada é inválida.' },
  status: { isIn: 'O status informado é inválido.' },
  reopenReason: { isString: 'O motivo da reabertura deve ser um texto.' },
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  overdue: { isBoolean: 'O parâmetro overdue deve ser verdadeiro ou falso.' },
} as const;

export const link = {
  id: { isUuid: 'O identificador informado é inválido.' },
} as const;

export const riskTransition = {
  toStatus: { isIn: 'O status de destino informado é inválido.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

export const requestApproval = {
  toStatus: { isIn: 'O status de destino informado é inválido para solicitação de aprovação.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

export const approvalDecision = {
  decision: { isIn: 'A decisão informada é inválida.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

export const registryQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  includeInactive: { isBoolean: 'O parâmetro includeInactive deve ser verdadeiro ou falso.' },
} as const;

export const riskRegisterQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O termo de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  riskLevel: { isIn: 'O nível de risco informado é inválido.' },
  riskLevelBasis: { isIn: 'A base do nível de risco informada é inválida.' },
  categoryId: { isUuid: 'A categoria informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  includeDescendants: {
    isBoolean: 'O parâmetro includeDescendants deve ser verdadeiro ou falso.',
  },
  ownerUserId: { isUuid: 'O gestor do risco informado é inválido.' },
  overdueReview: { isBoolean: 'O parâmetro overdueReview deve ser verdadeiro ou falso.' },
  overdueTreatment: { isBoolean: 'O parâmetro overdueTreatment deve ser verdadeiro ou falso.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const riskHistoryQuery = {
  type: { isIn: 'O tipo de entrada de histórico informado é inválido.' },
} as const;

export const riskAuditEventsQuery = {
  action: { maxLength: 'A ação informada deve ter no máximo 100 caracteres.' },
  actorUserId: { isUuid: 'O identificador de usuário informado é inválido.' },
  occurredFrom: { isDateString: 'A data inicial informada é inválida.' },
  occurredTo: { isDateString: 'A data final informada é inválida.' },
} as const;
