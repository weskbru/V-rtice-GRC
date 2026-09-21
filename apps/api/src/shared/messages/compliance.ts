/**
 * T018-ish/004-compliance-management — Compliance's own pt-BR message
 * catalog (CLAUDE.md §11.1: every new user-facing string lives in a
 * centralized catalog, never inline in a component or domain file).
 * Follows `controls.ts`'s own convention exactly — one file per module,
 * composed into `USER_MESSAGES` (see that file's own header).
 *
 * "Framework" is kept untranslated, matching `spec.md`'s own pt-BR prose
 * (it uses "framework" as a common noun throughout, the same way CLAUDE.md
 * §11.1 keeps "Dashboard"/"Compliance" — a term already consagrado in the
 * Brazilian GRC vocabulary this feature's own specification is written
 * in). "Requisito" is this module's own term for what the specification
 * also glosses as "cláusula" — the entity is named `Requirement`, and
 * "Requisito" is its direct, unambiguous pt-BR translation.
 */
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

  /** `RequirementComplianceReaderService`'s own observation-time audit
   * mark (research.md D-11) — the actor label for the
   * `REQUIREMENT_COMPLIANCE_STATE` audit event this mechanism writes. The
   * change was never a specific user's decision; it is the system
   * recognizing, on read, a state that already changed as a side effect
   * of an attestation decided elsewhere (usually in Controls). Using a
   * fixed, honest label rather than whichever caller happened to trigger
   * the read avoids implying that reader caused or decided the change. */
  complianceStateObserverActorLabel: 'Sistema (observação em leitura)',

  framework: {
    /** `CreateFrameworkVersionUseCase`/`UpdateFrameworkVersionUseCase` —
     * FR-002: `label` deve ser único dentro do framework. */
    versionLabelAlreadyUsed: 'Já existe uma versão deste framework com este identificador (label).',
    /** Path parameter `frameworkId` resolves, but the version being
     * addressed does not belong to it. */
    versionNotFound: 'Versão de framework não encontrada.',
  },

  frameworkVersion: {
    /** `UpdateFrameworkVersionUseCase` — FR-006: a versão publicada tem a
     * própria identidade fixada; o label não é mais editável. */
    notEditableAfterPublish:
      'Esta versão já foi publicada; o label de uma versão publicada não pode ser alterado.',
    /** `PublishFrameworkVersionUseCase` — FR-005: publicar uma versão sem
     * cláusula alguma é recusado. */
    publishRequiresAtLeastOneRequirement:
      'Não é possível publicar uma versão sem ao menos um requisito cadastrado.',
    /** `PublishFrameworkVersionUseCase` — a versão já está PUBLISHED; a
     * transição é de mão única (research.md D-3). */
    alreadyPublished: 'Esta versão já foi publicada.',
  },

  requirement: {
    /** `CreateRequirementUseCase`/`UpdateRequirementUseCase` — FR-004: uma
     * cláusula só é editável enquanto sua versão-pai está em rascunho. */
    parentVersionNotDraft:
      'A versão à qual este requisito pertence já foi publicada; requisitos de uma versão ' +
      'publicada são imutáveis.',
    /** Path parameter `versionId` resolves, but the requirement being
     * addressed does not belong to it (`createRequirement`'s nested
     * route). */
    parentVersionMismatch: 'Este requisito não pertence à versão de framework informada.',
  },

  /** User Story 2 — `LinkRequirementToControlUseCase`/
   * `UnlinkRequirementFromControlUseCase` (T032/T033). */
  requirementControlLink: {
    /** FR-022/ADR-020 part 4 — a control outside the caller's
     * organizational scope answers exactly as a nonexistent one (SC-005):
     * the two must never be distinguishable by message or by status. */
    controlNotFoundOrOutOfScope:
      'O controle informado não existe ou está fora do escopo do usuário.',
    /** FR-008 — an active link between this requirement and this control
     * already exists. */
    alreadyLinked: 'Este controle já está vinculado a este requisito.',
    /** FR-011 — the link addressed by `linkId` was already withdrawn. */
    alreadyWithdrawn: 'Este vínculo já foi desvinculado.',
  },

  /** User Story 3 — `DeclareRequirementNotApplicableUseCase`/
   * `RevokeRequirementApplicabilityUseCase` (T046). */
  applicability: {
    /** FR-015 AS1 — `justification` is required; omitting it (or an
     * empty/whitespace-only string) is refused with `422`, enforced here
     * rather than by the DTO (see `DeclareApplicabilityRequestDto`'s own
     * header). */
    justificationRequired:
      'A justificativa é obrigatória para declarar um requisito não aplicável.',
    /** FR-015 — a not-applicable declaration is already active for this
     * requirement; revoke it before declaring again (research.md D-7). */
    alreadyDeclared: 'Já existe uma declaração de não aplicabilidade vigente para este requisito.',
    /** The declaration addressed by `declarationId` was already revoked. */
    alreadyRevoked: 'Esta declaração já foi revertida.',
  },

  /** User Story 2 — `ExecuteMappingMigrationUseCase` (T036/T042). */
  mappingMigration: {
    /** FR-012 — `sourceFrameworkVersionId` must exist and belong to the
     * same framework as the target version in the path. */
    sourceFrameworkMismatch:
      'A versão de origem informada não existe ou pertence a um framework diferente da versão de ' +
      'destino.',
    /** `targetRequirementId` does not belong to the target version. */
    targetNotInTargetVersion: 'O requisito de destino informado não pertence à versão de destino.',
    /** `targetRequirementId` appears more than once in `correspondences`. */
    targetDuplicated:
      'O requisito de destino informado aparece mais de uma vez nas correspondências.',
    /** A `sourceRequirementIds` entry does not belong to
     * `sourceFrameworkVersionId`. */
    sourceNotInSourceVersion:
      'Um dos requisitos de origem informados não pertence à versão de origem.',
    /** Top-level message for the aggregated `errors[]` thrown when one or
     * more `correspondences` entries fail the checks above. */
    correspondencesInvalid: 'As correspondências informadas contêm um ou mais erros.',
  },
} as const;

/** `CreateFrameworkRequestDto`/`UpdateFrameworkRequestDto`. Mirrors
 * `controlFields`'s own shape in `controls.ts`. */
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

/** `ListFrameworksQueryDto` (`listFrameworks` operation). */
export const listFrameworksQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  q: { maxLength: 'O texto de busca deve ter no máximo 200 caracteres.' },
  origin: { isIn: 'A origem informada é inválida.' },
  sort: { isIn: 'O campo de ordenação informado é inválido.' },
  direction: { isIn: 'A direção de ordenação informada é inválida.' },
} as const;

/** `CreateFrameworkVersionRequestDto`/`UpdateFrameworkVersionRequestDto`. */
export const frameworkVersionFields = {
  label: {
    isString: 'O identificador da versão (label) deve ser um texto.',
    length: 'O identificador da versão (label) deve ter entre 1 e 100 caracteres.',
  },
} as const;

/** `ListFrameworkVersionsQueryDto` (`listFrameworkVersions` operation). */
export const listFrameworkVersionsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  status: { isIn: 'O status informado é inválido.' },
} as const;

/** `ListRequirementsQueryDto` (`listRequirements` operation). */
export const listRequirementsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
  complianceState: { isIn: 'O estado de conformidade informado é inválido.' },
} as const;

/** `CreateRequirementRequestDto`/`UpdateRequirementRequestDto`. */
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

/** `LinkRequirementControlRequestDto` (`linkRequirementToControl` operation). */
export const linkRequirementControlFields = {
  controlId: {
    isUuid: 'O identificador do controle (controlId) deve ser um UUID válido.',
  },
} as const;

/** `ListRequirementControlLinksQueryDto` (`listRequirementControlLinks`). */
export const listRequirementControlLinksQuery = {
  includeWithdrawn: { isBoolean: 'O parâmetro includeWithdrawn deve ser um booleano.' },
} as const;

/** `DeclareApplicabilityRequestDto` (`declareRequirementNotApplicable`). Its
 * non-emptiness ("at least 1 character") is enforced at the DOMAIN layer
 * (`DeclareRequirementNotApplicableUseCase`, `422`) — see that DTO's own
 * header — so this catalog only carries the type/max-length message the
 * DTO itself validates. */
export const declareApplicabilityFields = {
  justification: {
    isString: 'A justificativa deve ser um texto.',
    length: 'A justificativa deve ter no máximo 2000 caracteres.',
  },
} as const;

/** `ListApplicabilityDeclarationsQueryDto`/`ListMappingMigrationsQueryDto` —
 * plain page/pageSize, same shape as `listFrameworkVersionsQuery` above. */
export const listApplicabilityDeclarationsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

export const listMappingMigrationsQuery = {
  page: { isInt: 'A página informada é inválida.' },
  pageSize: { isInt: 'O tamanho de página informado é inválido.' },
} as const;

/** `MappingMigrationCorrespondenceRequestDto`/
 * `ExecuteMappingMigrationRequestDto` (`executeMappingMigration`). */
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
