/**
 * T015,T017-T022/006-assets-processes — Process. Identical in shape to
 * `assets.ts` (FR-020: Asset and Process are promoted symmetrically,
 * deliberately) — see that file's header for the full account this one
 * does not repeat.
 */
export const processes = {
  /** `NotFoundDomainError`'s `entityType` label. */
  entityLabel: 'Processo',

  /** Invariant A1 (data-model.md §4). Also reused by Invariant A2 and by
   * `updateProcess`'s own reassignment check. */
  orgUnitRequired: 'Informe a unidade organizacional do processo.',

  /** Invariant A4 (data-model.md §4). */
  nameRequired: 'Informe o nome do processo.',

  /** `DeactivateProcessUseCase`. */
  alreadyInactive: 'Este processo já está inativo.',

  /** `ReactivateProcessUseCase`. */
  alreadyActive: 'Este processo já está ativo.',

  /** `ProcessController.assertUpdateBodyNotEmpty`. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
} as const;

/** `CreateProcessRequestDto`/`UpdateProcessRequestDto` (T022). Identical in
 * shape to `assetFields` in `assets.ts`. */
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

/** `ListProcessesQueryDto` (T022). Identical in shape to `listAssetsQuery`
 * in `assets.ts`. */
export const listProcessesQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;
