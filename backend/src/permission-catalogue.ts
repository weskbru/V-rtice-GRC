import {
  combinePermissionDefinitions,
  CORE_PERMISSION_DEFINITIONS,
  type PermissionDefinition,
} from './core/authorization/domain/permissions';
import { ACTION_PERMISSION_DEFINITIONS } from './grc/action/domain/action-permissions';
import { EVIDENCE_PERMISSION_DEFINITIONS } from './grc/evidence/domain/evidence-permissions';
import { FINDING_PERMISSION_DEFINITIONS } from './grc/finding/domain/finding-permissions';
import { ASSET_PERMISSION_DEFINITIONS } from './modules/assets/domain/asset-permissions';
import { AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS } from './modules/audit-engagements/domain/audit-engagement-permissions';
import { COMPLIANCE_PERMISSION_DEFINITIONS } from './modules/compliance/compliance-permissions';
import { CONTROL_PERMISSION_DEFINITIONS } from './modules/controls/control-permissions';
import { INCIDENT_PERMISSION_DEFINITIONS } from './modules/incidents/domain/incident-permissions';
import { INDICATOR_PERMISSION_DEFINITIONS } from './modules/indicators/domain/indicator-permissions';
import { PROBLEM_PERMISSION_DEFINITIONS } from './modules/problems/domain/problem-permissions';
import { PROCESS_PERMISSION_DEFINITIONS } from './modules/processes/domain/process-permissions';
import { REPORT_PERMISSION_DEFINITIONS } from './modules/reports/domain/report-permissions';
import { RISK_PERMISSION_DEFINITIONS } from './modules/risk/domain/risk-permissions';

const ALL_PERMISSION_DEFINITIONS: readonly PermissionDefinition[] = combinePermissionDefinitions(
  CORE_PERMISSION_DEFINITIONS,
  RISK_PERMISSION_DEFINITIONS,
  EVIDENCE_PERMISSION_DEFINITIONS,
  ACTION_PERMISSION_DEFINITIONS,
  FINDING_PERMISSION_DEFINITIONS,
  CONTROL_PERMISSION_DEFINITIONS,
  COMPLIANCE_PERMISSION_DEFINITIONS,
  AUDIT_ENGAGEMENT_PERMISSION_DEFINITIONS,
  ASSET_PERMISSION_DEFINITIONS,
  PROCESS_PERMISSION_DEFINITIONS,
  INCIDENT_PERMISSION_DEFINITIONS,
  PROBLEM_PERMISSION_DEFINITIONS,
  INDICATOR_PERMISSION_DEFINITIONS,
  REPORT_PERMISSION_DEFINITIONS,
);

export function getAllPermissionDefinitions(): readonly PermissionDefinition[] {
  return ALL_PERMISSION_DEFINITIONS;
}
