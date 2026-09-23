import type { ActionOriginType, ActionStatus } from '@prisma/client';

export const action = {
  originTypeLabels: {
    RISK_TREATMENT: 'Tratamento de risco',
    FINDING: 'Achado',
    CONTROL_ASSESSMENT: 'Verificação de controle',
    INCIDENT: 'Incidente',
    PROBLEM: 'Problema',
    INDICATOR: 'Indicador',
  } satisfies Record<ActionOriginType, string>,

  statusLabels: {
    OPEN: 'Aberta',
    IN_PROGRESS: 'Em andamento',
    COMPLETED: 'Concluída',
    CANCELLED: 'Cancelada',
  } satisfies Record<ActionStatus, string>,

  entityLabel: 'Ação',

  responsibleNotFound: 'Usuário responsável pela ação não encontrado ou inativo.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  originNotFound: 'Origem não encontrada.',

  transition: {
    notAllowed: 'Esta transição de estado não é permitida para a ação a partir do estado atual.',
    reopenReasonRequired: 'Informe o motivo da reabertura.',
  },
} as const;

export const actionFields = {
  originType: { isIn: 'O tipo de origem informado é inválido.' },
  originId: { isUuid: 'O identificador de origem informado é inválido.' },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: { maxLength: 'A descrição deve ter no máximo 4000 caracteres.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  dueOn: { isDateString: 'O prazo informado é inválido.' },
} as const;

export const actionTransitionFields = {
  to: { isIn: 'O estado de destino informado é inválido.' },
  reason: { maxLength: 'O motivo deve ter no máximo 1000 caracteres.' },
} as const;

export const actionListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  responsibleUserId: { isUuid: 'O responsável informado é inválido.' },
  originType: { isIn: 'O tipo de origem informado é inválido.' },
  originId: { isUuid: 'O identificador de origem informado é inválido.' },
  overdue: { isBoolean: 'O filtro de atraso informado é inválido.' },
  dueBefore: { isDateString: 'A data informada é inválida.' },
} as const;

export const actionAuditEventsQuery = {
  action: { maxLength: 'A ação informada deve ter no máximo 100 caracteres.' },
  actorUserId: { isUuid: 'O identificador de usuário informado é inválido.' },
  occurredFrom: { isDateString: 'A data inicial informada é inválida.' },
  occurredTo: { isDateString: 'A data final informada é inválida.' },
} as const;
