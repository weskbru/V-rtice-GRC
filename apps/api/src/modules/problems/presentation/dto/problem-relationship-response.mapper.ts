/**
 * 008-incidents-problems, US3 — maps `ProblemRiskLinkRecord`/
 * `ProblemIncidentLinkRecord` to the wire shapes
 * `contracts/problems.openapi.yaml`'s `ProblemRiskLinkResponse`/
 * `ProblemIncidentLinkResponse` describe. ONE mapper per resource is the
 * only place a domain object becomes this DTO (ADR-009). Deliberately does
 * NOT expose `unlinkedBy` — neither schema declares it.
 */
import type { ProblemIncidentLinkRecord } from '../../domain/problem-incident-link.entity';
import type { ProblemRiskLinkRecord } from '../../domain/problem-risk-link.entity';

export interface RiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface IncidentRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface ProblemRiskLinkResponse {
  readonly id: string;
  readonly risk: RiskRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

export interface ProblemIncidentLinkResponse {
  readonly id: string;
  readonly incident: IncidentRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

function toUserRefResponse(user: { id: string; fullName: string }): UserRefResponse {
  return { id: user.id, fullName: user.fullName };
}

export function toProblemRiskLinkResponse(link: ProblemRiskLinkRecord): ProblemRiskLinkResponse {
  return {
    id: link.id,
    risk: { id: link.risk.id, code: link.risk.code, title: link.risk.title },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}

export function toProblemIncidentLinkResponse(
  link: ProblemIncidentLinkRecord,
): ProblemIncidentLinkResponse {
  return {
    id: link.id,
    incident: {
      id: link.incident.id,
      code: link.incident.code,
      title: link.incident.title,
      status: link.incident.status,
    },
    linkedBy: toUserRefResponse(link.linkedBy),
    linkedAt: link.linkedAt.toISOString(),
    unlinkedAt: link.unlinkedAt ? link.unlinkedAt.toISOString() : null,
  };
}
