import type { IncidentAssetLinkRecord } from '../../domain/incident-asset-link.entity';
import type { IncidentProblemLinkRecord } from '../../domain/incident-problem-link.entity';
import type { IncidentProcessLinkRecord } from '../../domain/incident-process-link.entity';
import type { IncidentRiskLinkRecord } from '../../domain/incident-risk-link.entity';

export interface RiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface AssetRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProcessRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProblemRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRiskLinkResponse {
  readonly id: string;
  readonly risk: RiskRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface IncidentAssetLinkResponse {
  readonly id: string;
  readonly asset: AssetRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface IncidentProcessLinkResponse {
  readonly id: string;
  readonly process: ProcessRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface IncidentProblemLinkResponse {
  readonly id: string;
  readonly problem: ProblemRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

function toUserRefResponse(user: { id: string; fullName: string }): UserRefResponse {
  return { id: user.id, fullName: user.fullName };
}

export function toIncidentRiskLinkResponse(link: IncidentRiskLinkRecord): IncidentRiskLinkResponse {
  return {
    id: link.id,
    risk: { id: link.risk.id, code: link.risk.code, title: link.risk.title },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}

export function toIncidentAssetLinkResponse(
  link: IncidentAssetLinkRecord,
): IncidentAssetLinkResponse {
  return {
    id: link.id,
    asset: { id: link.asset.id, code: link.asset.code, name: link.asset.name },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}

export function toIncidentProcessLinkResponse(
  link: IncidentProcessLinkRecord,
): IncidentProcessLinkResponse {
  return {
    id: link.id,
    process: { id: link.process.id, code: link.process.code, name: link.process.name },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}

export function toIncidentProblemLinkResponse(
  link: IncidentProblemLinkRecord,
): IncidentProblemLinkResponse {
  return {
    id: link.id,
    problem: {
      id: link.problem.id,
      code: link.problem.code,
      title: link.problem.title,
      status: link.problem.status,
    },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}
