import type {
  FindingCategory,
  FindingOrigin,
  FindingPriority,
  FindingSeverity,
  FindingStatus,
} from '@prisma/client';

export const findings = {
  categoryLabels: {
    NONCONFORMITY: 'Não conformidade',
    CONTROL_DEFICIENCY: 'Deficiência de controle',
    OBSERVATION: 'Observação',
    IMPROVEMENT_OPPORTUNITY: 'Oportunidade de melhoria',
  } satisfies Record<FindingCategory, string>,

  originLabels: {
    INTERNAL_ASSESSMENT: 'Autoavaliação interna',
    CONTROL_TESTING: 'Teste de controle',
    MANAGEMENT_REVIEW: 'Revisão da administração',
  } satisfies Record<FindingOrigin, string>,

  severityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    CRITICAL: 'Crítica',
  } satisfies Record<FindingSeverity, string>,

  priorityLabels: {
    LOW: 'Baixa',
    MEDIUM: 'Média',
    HIGH: 'Alta',
    URGENT: 'Urgente',
  } satisfies Record<FindingPriority, string>,

  statusLabels: {
    OPEN: 'Aberto',
    IN_REMEDIATION: 'Em remediação',
    CLOSED: 'Encerrado',
    ARCHIVED: 'Arquivado',
  } satisfies Record<FindingStatus, string>,

  entityLabel: 'Achado',

  ownerNotFound: 'Usuário responsável pelo achado não encontrado ou inativo.',
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  archivedNotEditable: 'Não é possível editar um achado arquivado.',

  transition: {
    notAllowed: 'Esta transição de estado não é permitida para o achado a partir do estado atual.',
  },

  close: {
    requirementNotMet:
      'O encerramento exige ao menos uma ação vinculada concluída ou uma justificativa.',
    segregationOfDuties:
      'Quem executou a remediação não pode encerrar o achado. Solicite que outra pessoa com ' +
      'permissão de encerramento realize esta ação.',
    evidenceRequired: 'O encerramento exige ao menos uma evidência vinculada e ativa ao achado.',
  },

  reopen: {
    reasonRequired: 'Informe o motivo da reabertura.',
  },

  link: {
    controlNotFound: 'Controle não encontrado, inativo ou fora do escopo do usuário.',
    controlAlreadyLinked: 'Este controle já está vinculado a este achado.',
    controlLinkNotFound: 'Vínculo com controle não encontrado.',
    controlLinkAlreadyWithdrawn: 'Este vínculo com controle já foi desfeito.',
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este achado.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',
  },

  controlLinkEntityLabel: 'Vínculo entre achado e controle',
  riskLinkEntityLabel: 'Vínculo entre achado e risco',
} as const;

export const findingFields = {
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  recommendation: { maxLength: 'A recomendação deve ter no máximo 4000 caracteres.' },
  category: { isIn: 'A categoria informada é inválida.' },
  origin: { isIn: 'A origem informada é inválida.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  priority: { isIn: 'A prioridade informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  identifiedOn: { isDateString: 'A data de identificação informada é inválida.' },
} as const;

export const findingListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  withoutRemediation: { isBoolean: 'O filtro de remediação informado é inválido.' },
} as const;

export const closeFindingFields = {
  justification: { maxLength: 'A justificativa deve ter no máximo 4000 caracteres.' },
} as const;

export const reopenFindingFields = {
  reason: {
    isString: 'O motivo deve ser um texto.',
    length: 'O motivo deve ter entre 1 e 4000 caracteres.',
  },
} as const;

export const linkFindingControlFields = {
  controlId: { isUuid: 'O controle informado é inválido.' },
} as const;

export const linkFindingRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;
