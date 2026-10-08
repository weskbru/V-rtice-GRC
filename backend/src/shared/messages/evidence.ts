import type { EvidenceSource, EvidenceStatus, EvidenceType } from '@prisma/client';

export const evidence = {
  typeLabels: {
    DOCUMENT: 'Documento',
    SCREENSHOT: 'Captura de tela',
    SYSTEM_LOG: 'Registro de sistema',
    ATTESTATION: 'Atestado',
    INSPECTION: 'Inspeção',
    OTHER: 'Outro',
  } satisfies Record<EvidenceType, string>,

  sourceLabels: {
    MANUAL_UPLOAD: 'Envio manual',
    SYSTEM_EXPORT: 'Exportação de sistema',
    THIRD_PARTY: 'Terceiro',
    INSPECTION: 'Inspeção',
  } satisfies Record<EvidenceSource, string>,

  statusLabels: {
    ACTIVE: 'Ativa',
    ARCHIVED: 'Arquivada',
  } satisfies Record<EvidenceStatus, string>,

  entityLabel: 'Evidência',
  linkEntityLabel: 'Vínculo de evidência',

  hasSubstanceRequired:
    'Informe ao menos uma referência externa ou uma observação — uma evidência precisa ser ' +
    'legível por um humano.',
  validUntilBeforeCollectedOn: 'A data de validade não pode ser anterior à data de coleta.',
  archivedNotEditable: 'Não é possível editar uma evidência arquivada.',
  archivedNotLinkable: 'Não é possível vincular uma evidência arquivada a um novo sujeito.',
  alreadyArchived: 'Esta evidência já está arquivada.',
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  ownerNotFound: 'Usuário responsável pela evidência não encontrado ou inativo.',
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  subjectFilterIncomplete: 'Informe tipo e identificador do sujeito juntos, ou nenhum dos dois.',

  link: {
    noteTooLong: 'A observação do vínculo deve ter no máximo 1000 caracteres.',
    alreadyLinked: 'Esta evidência já está vinculada a este sujeito.',
    subjectNotFound: 'Sujeito não encontrado.',
  },
} as const;

export const evidenceFields = {
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  title: {
    isString: 'O título deve ser um texto.',
    length: 'O título deve ter entre 1 e 200 caracteres.',
  },
  description: { maxLength: 'A descrição deve ter no máximo 4000 caracteres.' },
  type: { isIn: 'O tipo de evidência informado é inválido.' },
  source: { isIn: 'A procedência informada é inválida.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  collectedOn: { isDateString: 'A data de coleta informada é inválida.' },
  validUntil: { isDateString: 'A data de validade informada é inválida.' },
  externalUrl: {
    isUrl: 'A referência externa deve ser uma URL válida.',
    maxLength: 'A referência externa deve ter no máximo 2000 caracteres.',
  },
  observation: { maxLength: 'A observação deve ter no máximo 4000 caracteres.' },
} as const;

export const evidenceLinkFields = {
  subjectType: { isIn: 'O tipo de sujeito informado é inválido.' },
  subjectId: { isUuid: 'O identificador do sujeito informado é inválido.' },
  note: { maxLength: 'A observação do vínculo deve ter no máximo 1000 caracteres.' },
} as const;

export const evidenceListQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
  type: { isIn: 'O tipo de evidência informado é inválido.' },
  ownerUserId: { isUuid: 'O responsável informado é inválido.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  expiringBefore: { isDateString: 'A data informada é inválida.' },
  search: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  subjectType: { isIn: 'O tipo de sujeito informado é inválido.' },
  subjectId: { isUuid: 'O identificador do sujeito informado é inválido.' },
} as const;
