export type EvidenceType =
  'DOCUMENT' | 'SCREENSHOT' | 'SYSTEM_LOG' | 'ATTESTATION' | 'INSPECTION' | 'OTHER';

export type EvidenceSource = 'MANUAL_UPLOAD' | 'SYSTEM_EXPORT' | 'THIRD_PARTY' | 'INSPECTION';

export type EvidenceStatus = 'ACTIVE' | 'ARCHIVED';

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

  panel: {
    cardTitle: 'Evidência',
    cardDescription:
      'Provas que sustentam este registro — relatórios, capturas de tela, referências externas ' +
      'ou observações registradas em texto. Arquivar não remove o vínculo histórico.',
    loading: 'Carregando evidências…',
    loadError: 'Não foi possível carregar as evidências.',
    empty: 'Nenhuma evidência vinculada ainda.',
    newAction: 'Nova evidência',
    unlinkAction: 'Desvincular',
    archiveAction: 'Arquivar',
    expiredBadge: 'Vencida',
    archivedBadge: 'Arquivada',
    ownerLabel: (name: string): string => `Responsável: ${name}`,
    collectedOnLabel: (date: string): string => `Coletada em ${date}`,
    validUntilLabel: (date: string): string => `Válida até ${date}`,
    noteLabel: (note: string): string => `Observação do vínculo: ${note}`,

    unlinkConfirm: {
      title: 'Desvincular evidência',
      description: (title: string): string =>
        `"${title}" deixará de aparecer como prova vinculada aqui. O vínculo permanece na ` +
        'trilha de auditoria como histórico, e a evidência em si não é alterada.',
    },
    archiveConfirm: {
      title: 'Arquivar evidência',
      description: (title: string): string =>
        `"${title}" será arquivada e não poderá mais ser editada nem receber novos vínculos. ` +
        'Os vínculos já existentes permanecem consultáveis.',
    },

    unlinkSuccess: 'Vínculo removido.',
    unlinkError: 'Não foi possível desvincular a evidência.',
    archiveSuccess: 'Evidência arquivada.',
    archiveError: 'Não foi possível arquivar a evidência.',
    createLinkSuccess: 'Evidência registrada e vinculada.',
    createError: 'Não foi possível registrar a evidência.',
    linkError: 'A evidência foi registrada, mas não foi possível vinculá-la automaticamente.',
  },

  attachments: {
    sectionTitle: 'Anexos',
    caption: (evidenceLabel: string): string => `Anexos de ${evidenceLabel}`,
    loading: 'Carregando anexos…',
    loadError: 'Não foi possível carregar os anexos.',
    empty: 'Nenhum anexo enviado ainda.',
    chooseFileLabel: 'Selecionar arquivo',
    uploadLabel: 'Enviar arquivo',
    uploadingLabel: 'Enviando…',
    allowedTypesHint:
      'Formatos aceitos: PDF, PNG, JPEG ou texto simples (.txt). Tamanho máximo: 25 MB. O conteúdo do arquivo é conferido pelo servidor — um arquivo com a extensão trocada é recusado.',
    downloadLabel: 'Baixar anexo',
    withdrawLabel: 'Remover',
    loadMoreLabel: 'Carregar mais anexos',
    loadingMoreLabel: 'Carregando mais anexos…',
    uploadSuccess: 'Arquivo enviado.',
    uploadGenericError: 'Não foi possível enviar o arquivo. Tente novamente.',
    withdrawConfirm: {
      title: 'Remover anexo?',
      description: (fileName: string): string =>
        `O arquivo "${fileName}" não é apagado: ele deixa de aparecer nesta lista, mas continua ` +
        'registrado na trilha de auditoria, com autoria e data preservadas.',
    },
    withdrawSuccess: 'Anexo removido.',
    withdrawError: 'Não foi possível remover o anexo. Tente novamente.',
  },

  form: {
    title: 'Registrar evidência',
    description:
      'Toda evidência precisa de uma referência externa ou de uma observação — uma prova sempre ' +
      'legível por um humano. Um arquivo pode ser anexado depois de salvar.',
    fields: {
      title: { label: 'Título' },
      description: { label: 'Descrição', optional: '(opcional)' },
      type: { label: 'Tipo', placeholder: 'Selecione o tipo' },
      source: { label: 'Procedência', placeholder: 'Selecione a procedência' },
      ownerUserId: { label: 'Responsável' },
      collectedOn: { label: 'Data de coleta' },
      validUntil: { label: 'Válida até', optional: '(opcional)' },
      externalUrl: { label: 'Referência externa (URL)', optional: '(opcional)' },
      observation: { label: 'Observação', optional: '(opcional)' },
      note: { label: 'Observação do vínculo', optional: '(opcional)' },
      file: { label: 'Arquivo', optional: '(opcional)' },
    },
    substanceHint:
      'Preencha ao menos a referência externa ou a observação — as duas juntas também são aceitas.',
    cancel: 'Cancelar',
    submit: 'Registrar e vincular',
    submitting: 'Registrando…',
    fixHighlightedFields: 'Corrija os campos destacados e tente novamente.',
    genericError: 'Não foi possível concluir a operação. Tente novamente.',
    validation: {
      title: { required: 'O título é obrigatório.' },
      type: { required: 'Selecione o tipo da evidência.' },
      source: { required: 'Selecione a procedência da evidência.' },
      ownerUserId: { required: 'Selecione o responsável pela evidência.' },
      collectedOn: { required: 'Informe a data de coleta.' },
      externalUrl: { invalid: 'Informe uma URL válida.' },
      substance: 'Informe uma referência externa ou uma observação.',
      noteTooLong: 'A observação do vínculo deve ter no máximo 1000 caracteres.',
    },
  },
} as const;
