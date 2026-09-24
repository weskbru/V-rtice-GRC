import type { IndicatorMetricKey, IndicatorThresholdComparator } from '@prisma/client';

export const indicators = {
  entityLabel: 'Indicador',

  metricKeyLabels: {
    RISK_TOTAL_BY_LEVEL: 'Riscos por nível',
    RISK_TREATMENT_OVERDUE_COUNT: 'Tratamentos de risco em atraso',
    CONTROL_INACTIVE_COUNT: 'Controles inativos',
    COMPLIANCE_PERCENTAGE: 'Percentual de conformidade',
    AUDIT_ENGAGEMENT_OPEN_COUNT: 'Engajamentos de auditoria abertos',
    FINDING_OPEN_COUNT_BY_SEVERITY: 'Achados abertos por severidade',
    ASSET_INACTIVE_COUNT: 'Ativos inativos',
    PROCESS_INACTIVE_COUNT: 'Processos inativos',
    ACTION_OVERDUE_COUNT: 'Ações em atraso',
    INCIDENT_OPEN_COUNT_BY_SEVERITY: 'Incidentes abertos por severidade',
    PROBLEM_OPEN_COUNT_BY_SEVERITY: 'Problemas abertos por severidade',
  } satisfies Record<IndicatorMetricKey, string>,

  thresholdComparatorLabels: {
    GTE: 'Maior ou igual',
    GT: 'Maior',
    LTE: 'Menor ou igual',
    LT: 'Menor',
  } satisfies Record<IndicatorThresholdComparator, string>,

  thresholdBreachedTitle: (indicatorName: string): string =>
    `Limiar de indicador rompido: ${indicatorName}`,

  thresholdBreachedBody: (indicatorName: string, calculatedValue: string): string =>
    `O indicador "${indicatorName}" rompeu o limiar configurado. Valor calculado: ${calculatedValue}.`,

  thresholdRequiresBothFields:
    'O comparador e o valor do limiar devem ser informados juntos, ou nenhum dos dois.',

  measurementRequiresGlobalScope:
    'Registrar ou consultar o histórico de um indicador exige acesso à organização inteira.',

  unknownMetricKey: 'A chave de métrica informada não existe no catálogo de indicadores.',

  metricKeyEntityLabel: 'Chave de indicador',

  metricKeyAlreadyConfigured: 'Este indicador já possui uma definição configurada.',

  ownerNotFound: 'Usuário responsável pelo indicador não encontrado ou inativo.',

  sourcePermissionRequired: (permission: string): string =>
    `Esta operação também exige a permissão "${permission}".`,

  ownerHasNoOrgUnitForAction:
    'Não é possível criar uma ação a partir deste indicador: o responsável pelo indicador não possui unidade organizacional definida.',
} as const;

export const indicatorFields = {
  metricKey: {
    isString: 'A chave de métrica deve ser um texto.',
    length: 'A chave de métrica deve ter entre 1 e 100 caracteres.',
  },
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  ownerUserId: { isUuid: 'O usuário responsável informado é inválido.' },
  thresholdComparator: { isIn: 'O comparador de limiar informado é inválido.' },
  thresholdValue: { isNumber: 'O valor do limiar deve ser numérico.' },
  isActive: { isBoolean: 'O campo "ativo" deve ser um valor booleano.' },
} as const;

export const listIndicatorsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;
