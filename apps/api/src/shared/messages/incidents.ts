import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export const incidents = {
  severityLabels: {
    CRITICAL: 'Crítica',
    HIGH: 'Alta',
    MEDIUM: 'Média',
    LOW: 'Baixa',
  } satisfies Record<IncidentSeverity, string>,

  statusLabels: {
    OPEN: 'Aberto',
    IN_PROGRESS: 'Em andamento',
    RESOLVED: 'Resolvido',
    CLOSED: 'Encerrado',
    CANCELLED: 'Cancelado',
  } satisfies Record<IncidentStatus, string>,

  entityLabel: 'Incidente',

  ownerNotFound: 'Usuário responsável pelo incidente não encontrado ou inativo.',
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  transition: {
    notAllowed:
      'Esta transição de estado não é permitida para o incidente a partir do estado atual.',
    resolutionSummaryRequired:
      'O resumo da resolução é obrigatório para marcar o incidente como resolvido.',
    cancellationReasonRequired: 'O motivo do cancelamento é obrigatório.',
    reopenReasonRequired: 'O motivo da reabertura é obrigatório.',
  },

  link: {
    riskNotFound: 'Risco não encontrado, arquivado ou fora do escopo do usuário.',
    riskAlreadyLinked: 'Este risco já está vinculado a este incidente.',
    riskLinkNotFound: 'Vínculo com risco não encontrado.',
    riskLinkAlreadyWithdrawn: 'Este vínculo com risco já foi desfeito.',

    assetNotFound: 'Ativo não encontrado, inativo ou fora do escopo do usuário.',
    assetAlreadyLinked: 'Este ativo já está vinculado a este incidente.',
    assetLinkNotFound: 'Vínculo com ativo não encontrado.',
    assetLinkAlreadyWithdrawn: 'Este vínculo com ativo já foi desfeito.',

    processNotFound: 'Processo não encontrado, inativo ou fora do escopo do usuário.',
    processAlreadyLinked: 'Este processo já está vinculado a este incidente.',
    processLinkNotFound: 'Vínculo com processo não encontrado.',
    processLinkAlreadyWithdrawn: 'Este vínculo com processo já foi desfeito.',
  },

  riskLinkEntityLabel: 'Vínculo entre incidente e risco',
  assetLinkEntityLabel: 'Vínculo entre incidente e ativo',
  processLinkEntityLabel: 'Vínculo entre incidente e processo',
};

export const linkIncidentRiskFields = {
  riskId: { isUuid: 'O risco informado é inválido.' },
} as const;

export const linkIncidentAssetFields = {
  assetId: { isUuid: 'O ativo informado é inválido.' },
} as const;

export const linkIncidentProcessFields = {
  processId: { isUuid: 'O processo informado é inválido.' },
} as const;

export const incidentFields = {
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  severity: { isIn: 'A severidade informada é inválida.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  reportedOn: { isDateString: 'A data de reporte informada é inválida.' },
} as const;

export const incidentListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  severity: { isIn: 'A severidade informada é inválida.' },
  search: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const incidentTransitionFields = {
  toStatus: { isIn: 'O estado de destino informado é inválido.' },
  resolutionSummary: {
    isString: 'O resumo da resolução deve ser um texto.',
    maxLength: 'O resumo da resolução deve ter no máximo 4000 caracteres.',
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
