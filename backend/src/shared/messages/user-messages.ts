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
  problemTitle,

  server,

  auth,

  validation,

  passwordPolicy,

  dto: {
    email,
    password,
    currentPassword,
    newPassword,
    risk: riskFields,
    riskStatementItems,
    assessment,
    pageQuery,
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
    evidence: evidenceFields,
    evidenceLink: evidenceLinkFields,
    evidenceListQuery,
    action: actionFields,
    actionTransition: actionTransitionFields,
    actionListQuery,
    actionAuditEventsQuery,
    findings: findingFields,
    findingListQuery,
    closeFinding: closeFindingFields,
    reopenFinding: reopenFindingFields,
    linkFindingControl: linkFindingControlFields,
    linkFindingRisk: linkFindingRiskFields,
    controlAssessment: controlAssessmentFields,
    controlAssessmentAttestationDecision: controlAssessmentAttestationDecisionFields,
    control: controlFields,
    controlCatalogQuery,
    controlTransition: controlTransitionFields,
    framework: frameworkFields,
    listFrameworksQuery,
    frameworkVersion: frameworkVersionFields,
    listFrameworkVersionsQuery,
    requirement: requirementFields,
    listRequirementsQuery,
    linkRequirementControl: linkRequirementControlFields,
    listRequirementControlLinksQuery,
    declareApplicability: declareApplicabilityFields,
    listApplicabilityDeclarationsQuery,
    mappingMigrationCorrespondence: mappingMigrationCorrespondenceFields,
    executeMappingMigration: executeMappingMigrationFields,
    listMappingMigrationsQuery,
    auditEngagement: auditEngagementFields,
    cancelAuditEngagement: cancelAuditEngagementFields,
    listAuditEngagementsQuery,
    addFrameworkVersionScope: addFrameworkVersionScopeFields,
    addRequirementScope: addRequirementScopeFields,
    addControlScope: addControlScopeFields,
    asset: assetFields,
    listAssetsQuery,
    process: processFields,
    listProcessesQuery,
    problem: problemFields,
    problemCatalogQuery,
    problemTransition: problemTransitionFields,
    incident: incidentFields,
    incidentListQuery,
    incidentTransition: incidentTransitionFields,
    linkIncidentRisk: linkIncidentRiskFields,
    linkIncidentAsset: linkIncidentAssetFields,
    linkIncidentProcess: linkIncidentProcessFields,
    linkProblemRisk: linkProblemRiskFields,
    linkProblemIncident: linkProblemIncidentFields,
    indicator: indicatorFields,
    listIndicatorsQuery,
    report: reportFields,
    listReportsQuery,
    runReportQuery,
  },

  risk,

  evidence,

  action,

  findings,

  controls,

  compliance,

  auditEngagements,

  dashboard,

  admin,

  attachment,

  assets,

  processes,

  incidents,
  problems,

  indicators,
  reports,
} as const;
