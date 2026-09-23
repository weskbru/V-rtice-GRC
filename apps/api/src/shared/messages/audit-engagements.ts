export const auditEngagements = {
  entityLabel: 'Engajamento de auditoria',
  scopeFrameworkVersionEntityLabel: 'Vínculo de escopo com versão de framework',
  scopeRequirementEntityLabel: 'Vínculo de escopo com requisito',
  scopeControlEntityLabel: 'Vínculo de escopo com controle',

  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  leadAuditorNotFound: 'Usuário informado como responsável não encontrado ou inativo.',
  periodEndBeforeStart: 'O fim do período não pode ser anterior ao início.',
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para esta operação.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    transitionNotAllowed: 'Esta transição não é permitida a partir do estado atual do engajamento.',
    startRequiresScope:
      'O engajamento precisa ter ao menos um vínculo de escopo para ser iniciado.',
    editableOnlyWhilePlanning:
      'O engajamento só pode ser editado ou ter seu escopo alterado enquanto está em planejamento.',
    findingsRequireInProgress:
      'O engajamento precisa estar em execução para receber achados novos.',
    cancellationJustificationRequired: 'Informe a justificativa para descartar o engajamento.',
  },

  scope: {
    frameworkVersionNotFound: 'Versão de framework não encontrada ou não publicada.',
    requirementNotFound: 'Requisito não encontrado ou de versão ainda não publicada.',
    controlNotFound: 'Controle não encontrado.',
    frameworkVersionAlreadyInScope: 'Esta versão de framework já está no escopo deste engajamento.',
    requirementAlreadyInScope: 'Este requisito já está no escopo deste engajamento.',
    controlAlreadyInScope: 'Este controle já está no escopo deste engajamento.',
  },
} as const;

export const auditEngagementFields = {
  objective: {
    isString: 'O objetivo deve ser um texto.',
    length: 'O objetivo deve ter entre 1 e 2000 caracteres.',
  },
  periodStart: { isDateString: 'A data de início do período informada é inválida.' },
  periodEnd: { isDateString: 'A data de fim do período informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  leadAuditorUserId: { isUuid: 'O responsável informado é inválido.' },
} as const;

export const cancelAuditEngagementFields = {
  justification: {
    isString: 'A justificativa deve ser um texto.',
    length: 'A justificativa deve ter entre 1 e 2000 caracteres.',
  },
} as const;

export const listAuditEngagementsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  leadAuditorUserId: { isUuid: 'O responsável informado é inválido.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const addFrameworkVersionScopeFields = {
  frameworkVersionId: {
    isUuid: 'O identificador da versão de framework (frameworkVersionId) deve ser um UUID válido.',
  },
} as const;

export const addRequirementScopeFields = {
  requirementId: {
    isUuid: 'O identificador do requisito (requirementId) deve ser um UUID válido.',
  },
} as const;

export const addControlScopeFields = {
  controlId: {
    isUuid: 'O identificador do controle (controlId) deve ser um UUID válido.',
  },
} as const;
