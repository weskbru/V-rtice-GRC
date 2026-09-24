export const controls = {
  entityLabel: 'Controle',
  assessmentEntityLabel: 'Verificação',
  attestationEntityLabel: 'Atestação',
  processLinkEntityLabel: 'Vínculo com processo',
  assetLinkEntityLabel: 'Vínculo com ativo',
  processEntityLabel: 'Processo',
  assetEntityLabel: 'Ativo',

  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  orgUnitOutOfScope: 'A unidade organizacional informada está fora do seu escopo de acesso.',
  ownerNotFound: 'Usuário informado como dono não encontrado ou inativo.',
  ownerNotAssignable:
    'O usuário informado como dono não pertence à linha organizacional desta unidade.',
  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para esta operação.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  lifecycle: {
    transitionNotAllowed: 'Esta transição não é permitida a partir do estado atual do controle.',
    preconditions: {
      hasOwner: 'O controle precisa ter um dono definido para entrar em operação.',
      hasJustification: 'Informe a justificativa para descontinuar o controle.',
    },
  },

  assessment: {
    assessedOnInFuture: 'A data da verificação não pode ser futura.',
    controlNotActive: 'O controle precisa estar em operação (ACTIVE) para receber verificações.',

    attestation: {
      alreadyRequested: 'Esta verificação já possui uma atestação solicitada ou decidida.',
      notRequested: 'Nenhuma atestação foi solicitada para esta verificação.',
      alreadyDecided: 'Esta atestação já foi decidida.',
      segregationAssessor: 'Quem executou a verificação não pode atestar o próprio resultado.',
      segregationOwner: 'O dono do controle não pode atestar verificações do próprio controle.',
      segregationBoth:
        'Quem executou a verificação não pode atestar o próprio resultado, e o dono do ' +
        'controle não pode atestar verificações do próprio controle; esta pessoa acumula os ' +
        'dois papéis.',
    },
  },

  relationships: {
    controlRetired: 'O controle está descontinuado e não aceita novos vínculos.',
    processNotFound: 'Processo não encontrado.',
    assetNotFound: 'Ativo não encontrado.',
    processAlreadyLinked: 'Este controle já está vinculado a este processo.',
    assetAlreadyLinked: 'Este controle já está vinculado a este ativo.',
    linkAlreadyWithdrawn: 'Este vínculo já foi desfeito.',
  },
} as const;

export const controlAssessmentFields = {
  assessedOn: { isDateString: 'A data da verificação informada é inválida.' },
  result: { isIn: 'O resultado informado é inválido.' },
  conclusion: {
    isString: 'A conclusão deve ser um texto.',
    length: 'A conclusão deve ter entre 1 e 8000 caracteres.',
  },
} as const;

export const controlAssessmentAttestationDecisionFields = {
  decision: { isIn: 'A decisão informada é inválida.' },
  justification: { maxLength: 'A justificativa deve ter no máximo 2000 caracteres.' },
} as const;

export const controlFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  nature: { isIn: 'A natureza informada é inválida.' },
  type: { isIn: 'O tipo informado é inválido.' },
  frequency: { isIn: 'A frequência informada é inválida.' },
} as const;

export const controlCatalogQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  status: { isIn: 'O status informado é inválido.' },
  effectiveness: { isIn: 'A efetividade informada é inválida.' },
  nature: { isIn: 'A natureza informada é inválida.' },
  type: { isIn: 'O tipo informado é inválido.' },
  frequency: { isIn: 'A frequência informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O dono informado é inválido.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const controlTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  justification: {
    isString: 'A justificativa deve ser um texto.',
    maxLength: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;
