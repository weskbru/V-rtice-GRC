export const processes = {
  entityLabel: 'Processo',

  orgUnitRequired: 'Informe a unidade organizacional do processo.',

  nameRequired: 'Informe o nome do processo.',

  alreadyInactive: 'Este processo já está inativo.',

  alreadyActive: 'Este processo já está ativo.',

  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
} as const;

export const processFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
} as const;

export const listProcessesQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;
