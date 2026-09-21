/**
 * T003/002-shared-grc-foundation — Evidence (US1). Follows the modular
 * mechanism `risk.ts`/`user-messages.ts`'s own header establishes (A4
 * closure, F-23 #3): this file owns Evidence's own pt-BR strings, and is
 * composed into `USER_MESSAGES` by `user-messages.ts` — it never edits
 * `risk.ts`/`admin.ts`/any other module's file, and no other file edits
 * this one to add its own strings.
 *
 * ## Enum label maps — a missing translation is a compile error
 *
 * `evidenceTypeLabels`/`evidenceSourceLabels`/`evidenceStatusLabels` are
 * typed `satisfies Record<EvidenceType | EvidenceSource | EvidenceStatus,
 * string>` — CLAUDE.md §11.1/F-1 (`docs/deferred-findings.md`): a future
 * enum member added to `schema.prisma` without adding its label here fails
 * `tsc`, never silently renders the raw English identifier to a Brazilian
 * user. `@prisma/client`'s own enum types are used directly (not a
 * hand-duplicated local union) — the identical choice `risk.ts` already
 * makes for `RiskLevel`/`RiskStatus`/etc., and legitimate here for the same
 * reason: this file lives in `shared/**`, and `@prisma/client` is an
 * external package, not `core`/`modules`/`grc`, so importing its emitted
 * types does not violate the "shared imports nothing but shared" boundary
 * rule (`apps/api/eslint.config.mjs`).
 *
 * The enum label maps were the only strings populated ahead of the use
 * cases that need them; T032-T034 (US1) added the business-rule and DTO
 * validation strings below, at the point they were actually needed — not
 * invented ahead of the DTOs/use cases they describe, matching
 * `risk.ts`'s own `treatment`/`lifecycle` blocks having been added
 * incrementally.
 */
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

  /** `NotFoundDomainError`'s `entityType` label (FR-032, SC-005) — appears
   * verbatim in `problem+json`'s `detail` ("Evidência {id} não foi
   * encontrado(a)."). */
  entityLabel: 'Evidência',
  linkEntityLabel: 'Vínculo de evidência',

  /** Invariant E1, revised (data-model.md §2/spec.md FR-002 — see those
   * files' own revision notes): at least one of `externalUrl`/
   * `observation` is required. */
  hasSubstanceRequired:
    'Informe ao menos uma referência externa ou uma observação — uma evidência precisa ser ' +
    'legível por um humano.',
  /** Invariant E2. */
  validUntilBeforeCollectedOn: 'A data de validade não pode ser anterior à data de coleta.',
  /** FR-009: an archived evidence's descriptive fields are frozen. */
  archivedNotEditable: 'Não é possível editar uma evidência arquivada.',
  /** Adversarial-test decision — see `evidence.entity.ts#assertEvidenceLinkable`'s
   * own doc comment for the full reasoning. */
  archivedNotLinkable: 'Não é possível vincular uma evidência arquivada a um novo sujeito.',
  /** `archiveEvidence` on an already-archived record. */
  alreadyArchived: 'Esta evidência já está arquivada.',
  /** FR-003/referential integrity on `orgUnitId`. Used for BOTH "does not
   * exist" and "exists but is outside the caller's scope" — creation-time
   * non-disclosure (assurance fix, `grc-foundation.openapi.yaml`'s own
   * "answered as not-found" promise for this endpoint). A caller must
   * never be able to tell the two cases apart from the message alone, so
   * there is deliberately no separate `orgUnitOutOfScope` message here
   * (unlike `risk.ts`, whose OWN contract makes no such promise). */
  orgUnitNotFound: 'Unidade organizacional não encontrada ou inativa.',
  /** FR-004/referential integrity on `ownerUserId`. */
  ownerNotFound: 'Usuário responsável pela evidência não encontrado ou inativo.',
  /** Request-shape: `PATCH` body with no fields to change. */
  updateRequestEmpty: 'Informe ao menos um campo para atualizar.',
  /** `GET /evidence`'s `subjectType`/`subjectId` filter pair (the "evidence
   * panel on a domain screen" read path, see `list-evidence.usecase.ts`'s
   * own header) — both or neither. */
  subjectFilterIncomplete: 'Informe tipo e identificador do sujeito juntos, ou nenhum dos dois.',

  link: {
    /** `LinkEvidenceRequest.note`. */
    noteTooLong: 'A observação do vínculo deve ter no máximo 1000 caracteres.',
    /** Invariant L1 pre-check (409) — mirrors `risk.treatment.controlAlreadyLinked`. */
    alreadyLinked: 'Esta evidência já está vinculada a este sujeito.',
    /** The subject referenced by `subjectId` does not exist, or exists but
     * is outside the caller's organizational scope (FR-032, SC-005) — the
     * two are deliberately indistinguishable, so this message is used with
     * `NotFoundDomainError` and never discloses which case applies. */
    subjectNotFound: 'Sujeito não encontrado.',
  },
} as const;

/** `CreateEvidenceRequestDto`/`UpdateEvidenceRequestDto` (T034). */
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

/** `LinkEvidenceRequestDto` (T034). */
export const evidenceLinkFields = {
  subjectType: { isIn: 'O tipo de sujeito informado é inválido.' },
  subjectId: { isUuid: 'O identificador do sujeito informado é inválido.' },
  note: { maxLength: 'A observação do vínculo deve ter no máximo 1000 caracteres.' },
} as const;

/** `ListEvidenceQueryDto` (T034). */
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
