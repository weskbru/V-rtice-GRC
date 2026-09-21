/**
 * PharosGRC — Evidência (pt-BR), 002-shared-grc-foundation, T004.
 *
 * Follows `risks.ts`'s own modular convention (CLAUDE.md §11.1): one file
 * per GRC kernel capability, registered in `index.ts`, never inlined in a
 * component. `apps/web` has no `@prisma/client` dependency (that is an API
 * package concern), so the three union types below are hand-authored to
 * mirror `specs/002-shared-grc-foundation/data-model.md` §2's
 * `EvidenceType`/`EvidenceSource`/`EvidenceStatus` enums exactly — the same
 * choice `features/risks/types.ts` already makes for `RiskStatus`/
 * `RiskLevel` (see that file's own comment). A future
 * `features/evidence/types.ts` (US1, out of this task's scope) should
 * import these types from here rather than re-declaring them, the same way
 * `risks.ts` imports `RiskStatus`/`RiskLevel` FROM `features/risks/types.ts`
 * — whichever file is authored first for a given union is its source, and
 * the sibling file imports it.
 *
 * `satisfies Record<EvidenceType, string>` (F-1, `docs/deferred-findings.md`):
 * a value added to the union below without adding its label is a **compile
 * error**, never a raw English identifier silently shown to a Brazilian
 * user.
 */

/** Mirrors `enum EvidenceType` (data-model.md §2). */
export type EvidenceType =
  'DOCUMENT' | 'SCREENSHOT' | 'SYSTEM_LOG' | 'ATTESTATION' | 'INSPECTION' | 'OTHER';

/** Mirrors `enum EvidenceSource` (data-model.md §2, FR-010). */
export type EvidenceSource = 'MANUAL_UPLOAD' | 'SYSTEM_EXPORT' | 'THIRD_PARTY' | 'INSPECTION';

/** Mirrors `enum EvidenceStatus` (data-model.md §2) — deliberately only
 * two members; `expired` is a derived, read-time boolean, never a status
 * value (see the enum's own comment in `schema.prisma`). */
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

  /**
   * T036-T038/002-shared-grc-foundation, US1 — the evidence panel
   * consumed by any domain screen (currently the risk detail screen's own
   * "Evidência" tab, R-009: no new sidebar entry). Follows `risks.ts`'s
   * `attachments`/`comments` blocks as the established shape for a
   * collaboration-style panel embedded in another entity's detail screen.
   */
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

  /**
   * `EvidenceAttachmentsSection` (assurance-audit Fix 1) — one file list per
   * evidence card, following `risks.ts`'s own `attachments` block as the
   * established shape for `AttachmentList`'s labels
   * (`@pharos/design-system/components`, D-10).
   */
  attachments: {
    /** Visible small-caps label above the per-evidence attachment list — not a `Card` title, since this section is not its own card (see that component's own comment). */
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

  /** `EvidenceCreateDialog` (T036) — matches
   * `contracts/grc-foundation.openapi.yaml`'s `CreateEvidenceRequest`. */
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
