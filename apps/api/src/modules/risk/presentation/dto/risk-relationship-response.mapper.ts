/**
 * T143 — maps `ControlLinkRecord`/`EntityLinkRecord`
 * (`domain/ports/risk-relationship-repository.port.ts`) to
 * `contracts/risks.openapi.yaml`'s `RiskControlLink`/`RiskEntityLink` wire
 * shapes. The ONE place either becomes a response body (ADR-009).
 *
 * 013-incidents-problems-reverse-links — also maps `IncidentRiskLinkReadRecord`/
 * `ProblemRiskLinkReadRecord` (`shared/grc-ports/`) to
 * `RiskIncidentLinkResponse`/`RiskProblemLinkResponse`, the reverse,
 * read-only listings backing `GET /risks/{riskId}/incidents|problems`.
 * These two carry `linkedBy: {id, fullName}` (no `email`) — the shape
 * the owning module's own link table actually stores (mirrors
 * `IncidentRiskLinkResponse`'s own `linkedBy` on the forward side), unlike
 * `ControlLinkResponse`/`EntityLinkResponse` above.
 */
import type { UserRefResponse } from './risk-response.mapper';
import type {
  IncidentRiskLinkReadRecord,
  IncidentRefRecord,
} from '../../../../shared/grc-ports/incident-risk-link-read.port';
import type {
  ProblemRiskLinkReadRecord,
  ProblemRefRecord,
} from '../../../../shared/grc-ports/problem-risk-link-read.port';
import type {
  ControlLinkRecord,
  EntityLinkRecord,
  RegistryRefRecord,
} from '../../domain/ports/risk-relationship-repository.port';
import type { IncidentStatus, ProblemStatus } from '@prisma/client';

export interface RegistryRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ControlLinkResponse {
  readonly id: string;
  readonly control: RegistryRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedBy: UserRefResponse | null;
  readonly unlinkedAt: string | null;
}

export interface EntityLinkResponse {
  readonly id: string;
  readonly entity: RegistryRefResponse;
  readonly linkedBy: UserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

function toRegistryRefResponse(ref: RegistryRefRecord): RegistryRefResponse {
  return { id: ref.id, code: ref.code, name: ref.name };
}

export function toControlLinkResponse(record: ControlLinkRecord): ControlLinkResponse {
  return {
    id: record.id,
    control: toRegistryRefResponse(record.control),
    linkedBy: {
      id: record.linkedBy.id,
      fullName: record.linkedBy.fullName,
      email: record.linkedBy.email,
    },
    linkedAt: record.linkedAt.toISOString(),
    unlinkedBy: record.unlinkedBy
      ? {
          id: record.unlinkedBy.id,
          fullName: record.unlinkedBy.fullName,
          email: record.unlinkedBy.email,
        }
      : null,
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}

export function toEntityLinkResponse(record: EntityLinkRecord): EntityLinkResponse {
  return {
    id: record.id,
    entity: toRegistryRefResponse(record.entity),
    linkedBy: {
      id: record.linkedBy.id,
      fullName: record.linkedBy.fullName,
      email: record.linkedBy.email,
    },
    linkedAt: record.linkedAt.toISOString(),
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}

// ---------------------------------------------------------------------
// 013-incidents-problems-reverse-links — reverse, read-only listings
// ---------------------------------------------------------------------

export interface LinkUserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: IncidentStatus;
}

export interface ProblemRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly status: ProblemStatus;
}

export interface RiskIncidentLinkResponse {
  readonly id: string;
  readonly incident: IncidentRefResponse;
  readonly linkedBy: LinkUserRefResponse;
  readonly linkedAt: string;
  // No `unlinkedBy` — mirrors `IncidentRiskLinkResponse`/
  // `IncidentProblemLinkResponse`'s own precedent (incidents.openapi.yaml):
  // who withdrew the link is not exposed on this same entity's reverse
  // read either, only that it was.
  readonly unlinkedAt: string | null;
}

export interface RiskProblemLinkResponse {
  readonly id: string;
  readonly problem: ProblemRefResponse;
  readonly linkedBy: LinkUserRefResponse;
  readonly linkedAt: string;
  readonly unlinkedAt: string | null;
}

function toIncidentRefResponse(ref: IncidentRefRecord): IncidentRefResponse {
  return { id: ref.id, code: ref.code, title: ref.title, status: ref.status };
}

function toProblemRefResponse(ref: ProblemRefRecord): ProblemRefResponse {
  return { id: ref.id, code: ref.code, title: ref.title, status: ref.status };
}

export function toRiskIncidentLinkResponse(
  record: IncidentRiskLinkReadRecord,
): RiskIncidentLinkResponse {
  return {
    id: record.id,
    incident: toIncidentRefResponse(record.incident),
    linkedBy: { id: record.linkedBy.id, fullName: record.linkedBy.fullName },
    linkedAt: record.linkedAt.toISOString(),
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}

export function toRiskProblemLinkResponse(
  record: ProblemRiskLinkReadRecord,
): RiskProblemLinkResponse {
  return {
    id: record.id,
    problem: toProblemRefResponse(record.problem),
    linkedBy: { id: record.linkedBy.id, fullName: record.linkedBy.fullName },
    linkedAt: record.linkedAt.toISOString(),
    unlinkedAt: record.unlinkedAt ? record.unlinkedAt.toISOString() : null,
  };
}
