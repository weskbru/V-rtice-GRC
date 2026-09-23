export const reports = {
  entityLabel: 'Relatório',

  metricKeysEmpty: 'A lista de métricas do relatório deve conter ao menos uma chave.',

  unknownMetricKey: (metricKey: string): string =>
    `A chave de métrica "${metricKey}" não existe no catálogo de indicadores.`,
} as const;

export const reportFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    length: 'A descrição deve ter entre 1 e 8000 caracteres.',
  },
  metricKeys: {
    isArray: 'A lista de métricas deve ser um vetor.',
    arrayNotEmpty: 'A lista de métricas do relatório deve conter ao menos uma chave.',
    arrayUnique: 'A lista de métricas não pode repetir a mesma chave.',
    isIn: 'A lista de métricas contém uma chave que não existe no catálogo de indicadores.',
  },
  isActive: { isBoolean: 'O campo "ativo" deve ser um valor booleano.' },
} as const;

export const listReportsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

export const runReportQuery = {
  format: { isIn: 'O formato solicitado é inválido. Use "json" ou "csv".' },
} as const;
