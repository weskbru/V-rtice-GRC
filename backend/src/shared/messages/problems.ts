export const problems = {
  entityLabel: 'Problema',

  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  ownerNotFound: 'Usuário informado como dono não encontrado ou inativo.',
  ownerNotAssignable:
    'O usuário informado como dono não pode ser atribuído a esta unidade organizacional.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    transitionNotAllowed:
      'Esta transição de estado não é permitida para o problema a partir do estado atual.',
  },

  transition: {
    rootCauseRequired: 'A causa raiz é obrigatória para marcar o problema como resolvido.',
    cancellationReasonRequired: 'O motivo do cancelamento é obrigatório.',
    reopenReasonRequired: 'O motivo da reabertura é obrigatório.',
  },

  close: {
    requirementNotMet: 'O encerramento exige uma ação corretiva concluída para este problema.',
    segregationOfDuties:
      'Quem concluiu a ação corretiva não pode encerrar o problema. Solicite que outra pessoa ' +
      'com permissão de transição realize esta ação.',
  },

  link: {
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este problema.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',

    incidentNotFound: 'Incidente não encontrado ou fora do escopo do usuário.',
    incidentAlreadyLinked: 'Este incidente já está vinculado a este problema.',
    incidentLinkNotFound: 'Vínculo com incidente não encontrado.',
    incidentLinkAlreadyWithdrawn: 'Este vínculo com incidente já foi desfeito.',
  },

  riskLinkEntityLabel: 'Vínculo entre problema e risco',
  incidentLinkEntityLabel: 'Vínculo entre problema e incidente',
};

export const problemFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
} as const;

export const problemCatalogQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  search: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const problemTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  rootCause: {
    isString: 'A causa raiz deve ser um texto.',
    maxLength: 'A causa raiz deve ter no máximo 4000 caracteres.',
  },
  cancellationReason: {
    isString: 'O motivo do cancelamento deve ser um texto.',
    maxLength: 'O motivo do cancelamento deve ter no máximo 2000 caracteres.',
  },
  reopenReason: {
    isString: 'O motivo da reabertura deve ser um texto.',
    maxLength: 'O motivo da reabertura deve ter no máximo 2000 caracteres.',
  },
} as const;

export const linkProblemRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;

export const linkProblemIncidentFields = {
  incidentId: { isUuid: 'O incidente informado é inválido.' },
} as const;
