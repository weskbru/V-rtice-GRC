/**
 * T015,T017-T022/006-assets-processes — Asset. See `findings.ts`'s header
 * for the full explanation of the modular mechanism this file follows
 * identically (CLAUDE.md §11.1: every new user-facing string lives here,
 * in pt-BR, never inline in a component or use case).
 *
 * Fase 3 (User Story 1, T017-T022) adds the messages the write path and
 * the DTO field-message blocks need — `entityLabel`/`orgUnitRequired`/
 * `nameRequired` were already here from Fase 2 (T015).
 */
export const assets = {
  /** `NotFoundDomainError`'s `entityType` label (mirrors
   * `findings.entityLabel`'s own convention) — appears verbatim in
   * `problem+json`'s `detail` ("Ativo {id} não foi encontrado(a)."). */
  entityLabel: 'Ativo',

  /** Invariant A1 (data-model.md §4) — belt-and-suspenders domain check
   * behind `CreateAssetRequestDto`'s own `orgUnitId: string` (required,
   * `@IsUUID`), the same "re-checked in the domain" shape
   * `finding.entity.ts#assertReopenReasonProvided` already establishes for
   * its own DTO-level requirement. Also reused, unmodified, by Invariant
   * A2 (the nonexistent/out-of-scope collapse) and by `updateAsset`'s own
   * reassignment check — the message deliberately does not distinguish
   * "missing" from "out of scope" (FR-010 non-disclosure). */
  orgUnitRequired: 'Informe a unidade organizacional do ativo.',

  /** Invariant A4 (data-model.md §4) — name is required and may not be
   * only whitespace. */
  nameRequired: 'Informe o nome do ativo.',

  /** `DeactivateAssetUseCase` — data-model.md §3: deactivating an asset
   * already inactive is refused with 422, nothing changes. */
  alreadyInactive: 'Este ativo já está inativo.',

  /** `ReactivateAssetUseCase` — mirror of `alreadyInactive` above. */
  alreadyActive: 'Este ativo já está ativo.',

  /** `AssetController.assertUpdateBodyNotEmpty` — `UpdateAssetRequest`'s
   * `minProperties: 1`. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
} as const;

/** `CreateAssetRequestDto`/`UpdateAssetRequestDto` (T022, operations 2/4 of
 * contracts/assets.openapi.yaml). Mirrors `controlFields`'s own shape in
 * `controls.ts`. */
export const assetFields = {
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

/** `ListAssetsQueryDto` (T022, `listAssetCatalog` operation). Mirrors
 * `controlCatalogQuery`'s own shape in `controls.ts`, narrowed to the
 * filters `contracts/assets.openapi.yaml` actually declares. */
export const listAssetsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  orgUnitId: { isUuid: 'A unidade organizacional informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;
