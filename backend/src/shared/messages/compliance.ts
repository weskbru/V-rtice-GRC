export const compliance = {
  frameworkEntityLabel: 'Framework',
  frameworkVersionEntityLabel: 'Versão do framework',
  requirementEntityLabel: 'Requisito',
  requirementControlLinkEntityLabel: 'Vínculo entre requisito e controle',
  applicabilityDeclarationEntityLabel: 'Declaração de aplicabilidade',
  mappingMigrationEntityLabel: 'Migração de mapeamento',

  ifMatchRequired: 'O cabeçalho If-Match é obrigatório para esta operação.',
  ifMatchInvalid: 'O cabeçalho If-Match informado é inválido.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',

  complianceStateObserverActorLabel: 'Sistema (observação em leitura)',

  framework: {
    versionLabelAlreadyUsed: 'Já existe uma versão deste framework com este identificador (label).',
    versionNotFound: 'Versão de framework não encontrada.',
  },

  frameworkVersion: {
    notEditableAfterPublish:
      'Esta versão já foi publicada; o label de uma versão publicada não pode ser alterado.',
    publishRequiresAtLeastOneRequirement:
      'Não é possível publicar uma versão sem ao menos um requisito cadastrado.',
    alreadyPublished: 'Esta versão já foi publicada.',
  },

  requirement: {
    parentVersionNotDraft:
      'A versão à qual este requisito pertence já foi publicada; requisitos de uma versão ' +
      'publicada são imutáveis.',
    parentVersionMismatch: 'Este requisito não pertence à versão de framework informada.',
  },

  requirementControlLink: {
    controlNotFoundOrOutOfScope:
      'O controle informado não existe ou está fora do escopo do usuário.',
    alreadyLinked: 'Este controle já está vinculado a este requisito.',
    alreadyWithdrawn: 'Este vínculo já foi desvinculado.',
  },

  applicability: {
    justificationRequired:
      'A justificativa é obrigatória para declarar um requisito não aplicável.',
    alreadyDeclared: 'Já existe uma declaração de não aplicabilidade vigente para este requisito.',
    alreadyRevoked: 'Esta declaração já foi revertida.',
  },

  mappingMigration: {
    sourceFrameworkMismatch:
      'A versão de origem informada não existe ou pertence a um framework diferente da versão de ' +
      'destino.',
    targetNotInTargetVersion: 'O requisito de destino informado não pertence à versão de destino.',
    targetDuplicated:
      'O requisito de destino informado aparece mais de uma vez nas correspondências.',
    sourceNotInSourceVersion:
      'Um dos requisitos de origem informados não pertence à versão de origem.',
    correspondencesInvalid: 'As correspondências informadas contêm um ou mais erros.',
  },
} as const;

export const frameworkFields = {
  name: {
    isString: 'O nome deve ser um texto.',
    length: 'O nome deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
  origin: { isIn: 'A origem informada é inválida.' },
} as const;

export const listFrameworksQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  origin: { isIn: 'A origem informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

export const frameworkVersionFields = {
  label: {
    isString: 'O identificador da versão (label) deve ser um texto.',
    length: 'O identificador da versão (label) deve ter entre 1 e 100 caracteres.',
  },
} as const;

export const listFrameworkVersionsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
} as const;

export const listRequirementsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  complianceState: { isIn: 'O estado de conformidade informado é inválido.' },
} as const;

export const requirementFields = {
  externalRef: {
    isString: 'O identificador da cláusula na norma (externalRef) deve ser um texto.',
    length: 'O identificador da cláusula na norma (externalRef) deve ter entre 1 e 100 caracteres.',
  },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 300 caracteres.',
  },
  description: {
    isString: 'A descrição deve ser um texto.',
    minLength: 'A descrição não pode ser vazia.',
  },
} as const;

export const linkRequirementControlFields = {
  controlId: {
    isUuid: 'O identificador do controle (controlId) deve ser um UUID válido.',
  },
} as const;

export const listRequirementControlLinksQuery = {
  includeWithdrawn: { isBoolean: 'O parâmetro includeWithdrawn deve ser um booleano.' },
} as const;

export const declareApplicabilityFields = {
  justification: {
    isString: 'A justificativa deve ser um texto.',
    length: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

export const listApplicabilityDeclarationsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

export const listMappingMigrationsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

export const mappingMigrationCorrespondenceFields = {
  targetRequirementId: {
    isUuid: 'O identificador do requisito de destino deve ser um UUID válido.',
  },
  sourceRequirementIds: {
    isUuid: 'Os identificadores de requisitos de origem devem ser UUIDs válidos.',
    arrayMinSize: 'Informe ao menos um requisito de origem por correspondência.',
  },
} as const;

export const executeMappingMigrationFields = {
  sourceFrameworkVersionId: {
    isUuid:
      'O identificador da versão de origem (sourceFrameworkVersionId) deve ser um UUID válido.',
  },
  correspondences: {
    isArray: 'As correspondências devem ser uma lista.',
  },
} as const;
