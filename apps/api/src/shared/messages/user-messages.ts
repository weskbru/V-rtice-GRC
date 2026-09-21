/**
 * Centralized catalog of user-facing text (pt-BR) — localization cleanup,
 * see `specs/` history and CLAUDE.md §"Qualidade"/§"Regra fundamental".
 *
 * Every string reachable here can reach a human through the
 * `application/problem+json` body rendered by the frontend's `ErrorState`
 * component (RFC 9457, ADR-009), or a `class-validator` field-level error
 * folded into that body's `errors[]` array. It deliberately does NOT
 * include: `type` URIs (stable RFC 9457 identifiers), audit action names,
 * Prisma/database enum values, or log-only text — see
 * `infrastructure/http/problem-details.filter.ts`'s header for the
 * boundary between "reaches the client" and "log/operator only".
 *
 * `risk.history` (T166/US7) is the one deliberate exception to "only
 * problem+json/validation text": `RiskHistoryEntry.summary`
 * (`contracts/risks.openapi.yaml`) is a human-readable pt-BR sentence
 * rendered directly into a SUCCESS response body, not an error — CLAUDE.md
 * §11.1 names this catalog as one of the two centralized catalogs for ANY
 * new user-facing string regardless of response kind, so it belongs here
 * rather than inline in `risk-history.service.ts`.
 *
 * Lives in `shared/**` (ADR-011): this module (and every file it composes
 * from) has no imports of its own except TYPE-ONLY imports of
 * `@prisma/client`'s enums (an external package, not `core`/`modules`/
 * `infrastructure` — the boundary rule this comment describes governs
 * those three internal areas, not `node_modules` types), so `core/**`,
 * `modules/**` and `infrastructure/**` may all still depend on it without
 * violating the "shared imports nothing but shared" boundary rule
 * (`apps/api/eslint.config.mjs`) — a plain string catalog is exactly the
 * kind of leaf dependency that boundary is designed to allow everywhere.
 *
 * `as const` (plus consumers always writing the full dotted path, e.g.
 * `USER_MESSAGES.auth.invalidCredentials`, never a dynamically-built key)
 * means a typo'd key is a `tsc` compile error, not a silently-`undefined`
 * string reaching a response body. The enum-keyed label maps under
 * `risk.history` are typed `Record<Enum, string>` (never the looser
 * `Record<string, string>` F-1 warns against, `docs/deferred-findings.md`)
 * so adding a new enum member without adding its label fails `tsc`.
 *
 * F-23 #3 (`docs/deferred-findings.md`): a single 690-line file forced
 * every module — including one not yet built — to edit the same catalog
 * as every other module. This file is now composition only: each area
 * owns its own strings in its own file (`risk.ts` for the risk module,
 * `admin.ts`/`identity.ts`/`organizations.ts`/`comments.ts`/
 * `notifications.ts`/`attachment.ts`/`dashboard.ts` for the core
 * capabilities that own theirs, `problem-details.ts`/`common.ts`/
 * `validation.ts` for text no single module owns) and is composed into
 * `USER_MESSAGES` below. A future business module (`modules/controls`,
 * say) adds its own `controls.ts` here, imports it below, and adds it to
 * the object literal — it never edits `risk.ts`, `admin.ts`, or any other
 * module's file to do so. `dto` stays one flat namespace because 86
 * existing call sites already address it by its current dotted path
 * (`USER_MESSAGES.dto.<x>`); a new module's DTO messages join it the same
 * way, by one added property, not by restructuring it.
 */
import {
  action,
  actionAuditEventsQuery,
  actionFields,
  actionListQuery,
  actionTransitionFields,
} from './action';
import {
  admin,
  adminOrgUnitsQuery,
  adminUser,
  grantOrgScope,
  listAdminUsersQuery,
  listPermissionsQuery,
  listRolesQuery,
  replaceUserRoles,
  resetUserPassword,
  setOrgUnitStatus,
  setUserStatus,
  writeOrgUnit,
  writeRole,
} from './admin';
import { assetFields, assets, listAssetsQuery } from './assets';
import { attachment } from './attachment';
import {
  addControlScopeFields,
  addFrameworkVersionScopeFields,
  addRequirementScopeFields,
  auditEngagementFields,
  auditEngagements,
  cancelAuditEngagementFields,
  listAuditEngagementsQuery,
} from './audit-engagements';
import { comment } from './comments';
import { entityId, entityType } from './common';
import {
  compliance,
  declareApplicabilityFields,
  executeMappingMigrationFields,
  frameworkFields,
  frameworkVersionFields,
  linkRequirementControlFields,
  listApplicabilityDeclarationsQuery,
  listFrameworksQuery,
  listFrameworkVersionsQuery,
  listMappingMigrationsQuery,
  listRequirementControlLinksQuery,
  listRequirementsQuery,
  mappingMigrationCorrespondenceFields,
  requirementFields,
} from './compliance';
import {
  controlAssessmentAttestationDecisionFields,
  controlAssessmentFields,
  controlCatalogQuery,
  controlFields,
  controls,
  controlTransitionFields,
} from './controls';
import { dashboard } from './dashboard';
import { evidence, evidenceFields, evidenceLinkFields, evidenceListQuery } from './evidence';
import {
  closeFindingFields,
  findingFields,
  findingListQuery,
  findings,
  linkFindingControlFields,
  linkFindingRiskFields,
  reopenFindingFields,
} from './findings';
import {
  auth,
  currentPassword,
  directoryQuery,
  email,
  newPassword,
  password,
  passwordPolicy,
} from './identity';
import {
  incidentFields,
  incidentListQuery,
  incidents,
  incidentTransitionFields,
  linkIncidentAssetFields,
  linkIncidentProcessFields,
  linkIncidentRiskFields,
} from './incidents';
import { indicatorFields, indicators, listIndicatorsQuery } from './indicators';
import { notification } from './notifications';
import { orgUnitsQuery } from './organizations';
import { problemTitle, server } from './problem-details';
import {
  linkProblemIncidentFields,
  linkProblemRiskFields,
  problemCatalogQuery,
  problemFields,
  problems,
  problemTransitionFields,
} from './problems';
import { listProcessesQuery, processes, processFields } from './processes';
import { listReportsQuery, reportFields, reports, runReportQuery } from './reports';
import {
  approvalDecision,
  assessment,
  link,
  methodology,
  pageQuery,
  referenceDataQuery,
  registryQuery,
  requestApproval,
  risk,
  riskAuditEventsQuery,
  riskFields,
  riskHistoryQuery,
  riskRegisterQuery,
  riskStatementItems,
  riskTransition,
  treatmentAction,
  treatmentDecision,
} from './risk';
import { validation } from './validation';

export const USER_MESSAGES = {
  /** `title` for the generic HTTP-status problem+json shapes. */
  problemTitle,

  server,

  auth,

  validation,

  /** Field-level messages for `PasswordPolicyViolation` (T060). */
  passwordPolicy,

  /** `class-validator` field messages for identity request DTOs. */
  dto: {
    email,
    password,
    currentPassword,
    newPassword,
    /** `CreateRiskRequestDto`/`UpdateRiskRequestDto` (T091). */
    risk: riskFields,
    riskStatementItems,
    assessment,
    pageQuery,
    /** `UploadAttachmentRequestDto`/`ListAttachmentsQueryDto`/
     * `CreateCommentRequestDto`/`ListCommentsQueryDto` (T190/T192) — shared
     * across every `(entityType, entityId)` parent reference. */
    entityType,
    entityId,
    comment,
    notification,
    methodology,
    referenceDataQuery,
    orgUnitsQuery,
    directoryQuery,
    treatmentDecision,
    treatmentAction,
    link,
    riskTransition,
    requestApproval,
    approvalDecision,
    registryQuery,
    riskRegisterQuery,
    riskHistoryQuery,
    riskAuditEventsQuery,
    adminUser,
    setUserStatus,
    resetUserPassword,
    replaceUserRoles,
    grantOrgScope,
    listAdminUsersQuery,
    writeRole,
    listRolesQuery,
    listPermissionsQuery,
    writeOrgUnit,
    setOrgUnitStatus,
    adminOrgUnitsQuery,
    /** `CreateEvidenceRequestDto`/`UpdateEvidenceRequestDto` (002-shared-grc-foundation, T034). */
    evidence: evidenceFields,
    evidenceLink: evidenceLinkFields,
    evidenceListQuery,
    /** `CreateActionRequestDto`/`UpdateActionRequestDto`/
     * `TransitionActionRequestDto`/`ListActionQueryDto`
     * (002-shared-grc-foundation, T053). */
    action: actionFields,
    actionTransition: actionTransitionFields,
    actionListQuery,
    /** `ListActionAuditEventsQueryDto` (`GET /actions/{actionId}/audit-events`). */
    actionAuditEventsQuery,
    /** `CreateFindingRequestDto`/`UpdateFindingRequestDto`/
     * `CloseFindingRequestDto`/`ReopenFindingRequestDto`/
     * `ListFindingQueryDto` (002-shared-grc-foundation, T073). */
    findings: findingFields,
    findingListQuery,
    closeFinding: closeFindingFields,
    reopenFinding: reopenFindingFields,
    /** `CreateFindingControlLinkRequestDto`/`CreateFindingRiskLinkRequestDto`
     * (005-audit-findings, User Story 3, operations 14-19). */
    linkFindingControl: linkFindingControlFields,
    linkFindingRisk: linkFindingRiskFields,
    /** `CreateControlAssessmentRequestDto`/
     * `ControlAssessmentAttestationDecisionRequestDto` (T033,
     * 003-controls-management, User Story 2). */
    controlAssessment: controlAssessmentFields,
    controlAssessmentAttestationDecision: controlAssessmentAttestationDecisionFields,
    /** `CreateControlRequestDto`/`UpdateControlRequestDto`/
     * `ListControlsQueryDto`/`TransitionControlRequestDto` (T023,
     * 003-controls-management, User Story 1, operations 1-6). */
    control: controlFields,
    controlCatalogQuery,
    controlTransition: controlTransitionFields,
    /** `CreateFrameworkRequestDto`/`UpdateFrameworkRequestDto`/
     * `ListFrameworksQueryDto`/`CreateFrameworkVersionRequestDto`/
     * `UpdateFrameworkVersionRequestDto`/`ListFrameworkVersionsQueryDto`/
     * `CreateRequirementRequestDto`/`UpdateRequirementRequestDto`
     * (004-compliance-management, User Story 1, operations 1-9/11/13). */
    framework: frameworkFields,
    listFrameworksQuery,
    frameworkVersion: frameworkVersionFields,
    listFrameworkVersionsQuery,
    requirement: requirementFields,
    /** `LinkRequirementControlRequestDto`/`ListRequirementControlLinksQueryDto`/
     * `DeclareApplicabilityRequestDto`/`ListApplicabilityDeclarationsQueryDto`/
     * `MappingMigrationCorrespondenceRequestDto`/
     * `ExecuteMappingMigrationRequestDto`/`ListMappingMigrationsQueryDto`
     * (004-compliance-management, User Story 2/3, operations
     * 10/12/14-23). */
    listRequirementsQuery,
    linkRequirementControl: linkRequirementControlFields,
    listRequirementControlLinksQuery,
    declareApplicability: declareApplicabilityFields,
    listApplicabilityDeclarationsQuery,
    mappingMigrationCorrespondence: mappingMigrationCorrespondenceFields,
    executeMappingMigration: executeMappingMigrationFields,
    listMappingMigrationsQuery,
    /** `CreateAuditEngagementRequestDto`/`UpdateAuditEngagementRequestDto`/
     * `CancelAuditEngagementRequestDto`/`ListAuditEngagementsQueryDto`/
     * `AddFrameworkVersionScopeRequestDto`/`AddRequirementScopeRequestDto`/
     * `AddControlScopeRequestDto` (005-audit-findings, User Story 1, T040,
     * operations 1-11). */
    auditEngagement: auditEngagementFields,
    cancelAuditEngagement: cancelAuditEngagementFields,
    listAuditEngagementsQuery,
    addFrameworkVersionScope: addFrameworkVersionScopeFields,
    addRequirementScope: addRequirementScopeFields,
    addControlScope: addControlScopeFields,
    /** `CreateAssetRequestDto`/`UpdateAssetRequestDto`/`ListAssetsQueryDto`
     * (006-assets-processes, User Story 1, T022, operations 1-6 of
     * contracts/assets.openapi.yaml). */
    asset: assetFields,
    listAssetsQuery,
    /** `CreateProcessRequestDto`/`UpdateProcessRequestDto`/
     * `ListProcessesQueryDto` (006-assets-processes, User Story 1, T022,
     * operations 1-6 of contracts/processes.openapi.yaml). */
    process: processFields,
    listProcessesQuery,
    /** `CreateProblemRequestDto`/`UpdateProblemRequestDto`/
     * `ListProblemsQueryDto`/`TransitionProblemRequestDto`
     * (008-incidents-problems, User Story 2, operations 1-2/4-5 of
     * contracts/problems.openapi.yaml). */
    problem: problemFields,
    problemCatalogQuery,
    problemTransition: problemTransitionFields,
    /** `CreateIncidentRequestDto`/`UpdateIncidentRequestDto`/
     * `ListIncidentsQueryDto`/`TransitionIncidentRequestDto`
     * (008-incidents-problems, User Story 1, operations
     * `createIncident`/`updateIncident`/`listIncidents`/
     * `transitionIncident`). */
    incident: incidentFields,
    incidentListQuery,
    incidentTransition: incidentTransitionFields,
    /** `LinkIncidentRiskRequestDto`/`LinkIncidentAssetRequestDto`/
     * `LinkIncidentProcessRequestDto` (008-incidents-problems, User Story
     * 3, operations `linkIncidentToRisk`/`linkIncidentToAsset`/
     * `linkIncidentToProcess`). */
    linkIncidentRisk: linkIncidentRiskFields,
    linkIncidentAsset: linkIncidentAssetFields,
    linkIncidentProcess: linkIncidentProcessFields,
    /** `LinkProblemRiskRequestDto`/`LinkProblemIncidentRequestDto`
     * (008-incidents-problems, User Story 3, operations
     * `linkProblemToRisk`/`linkProblemToIncident`). */
    linkProblemRisk: linkProblemRiskFields,
    linkProblemIncident: linkProblemIncidentFields,
    /** `CreateIndicatorDefinitionRequestDto`/`ListIndicatorDefinitionsQueryDto`
     * (009-indicators-reports, Fase 3, T031, operations
     * `createIndicatorDefinition`/`listIndicatorDefinitions`). */
    indicator: indicatorFields,
    listIndicatorsQuery,
    /** `CreateReportDefinitionRequestDto`/`ListReportDefinitionsQueryDto`/
     * `RunReportQueryDto` (009-indicators-reports, Fase 7, T054, operations
     * `createReportDefinition`/`listReportDefinitions`/`runReport`). */
    report: reportFields,
    listReportsQuery,
    runReportQuery,
  },

  risk,

  /** 002-shared-grc-foundation, T003 — one property per GRC kernel
   * capability (ADR-016), each owning its own file, composed here exactly
   * as `risk` above is. */
  evidence,

  action,

  findings,

  // 003-controls-management, T018 — the second business module (after
  // Risk) to own its file, composed here exactly as `risk`/`evidence`/
  // `action`/`findings` above.
  controls,

  // 004-compliance-management — the third business module, same
  // one-file-per-module composition.
  compliance,

  // 005-audit-findings — the fourth business module, same
  // one-file-per-module composition.
  auditEngagements,

  dashboard,

  admin,

  attachment,

  // 006-assets-processes — the fifth and sixth business modules, same
  // one-file-per-module composition. Fase 3 (User Story 1, T017-T022) added
  // the write-path/DTO field-message blocks above (`dto.asset`/
  // `dto.process`/`dto.listAssetsQuery`/`dto.listProcessesQuery`) the same
  // way `findingFields` did for Finding.
  assets,

  processes,

  // 008-incidents-problems — the seventh and eighth business modules, same
  // one-file-per-module composition.
  incidents,
  problems,

  // 009-indicators-reports, Fase 1 (T006) — the ninth and tenth business
  // modules, same one-file-per-module composition. `indicators.ts` started
  // as Fase 2's (T010) minimal foundation subset (`entityLabel` only); T006
  // added the rest (metric/comparator labels, threshold-breach notification
  // body, domain error messages) to that same file. `reports.ts` is, for
  // now, the same minimal foundation subset `indicators.ts` started as.
  indicators,
  reports,
} as const;
