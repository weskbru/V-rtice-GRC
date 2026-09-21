/**
 * 008-incidents-problems, US1 — maps `IncidentRecord`
 * (`domain/ports/incident-repository.port.ts`) to the wire shape
 * `contracts/incidents.openapi.yaml`'s `IncidentDetail` schema describes
 * (a superset of `IncidentSummary` — this mapper always returns the full
 * detail shape, mirroring `toFindingResponse`'s own single-mapper
 * discipline: ONE function is the only place a domain object becomes this
 * DTO, ADR-009).
 */
import type { IncidentRecord, UserRefRecord } from '../../domain/ports/incident-repository.port';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

export interface OrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface UserRefResponse {
  readonly id: string;
  readonly fullName: string;
}

export interface IncidentResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
  readonly severity: IncidentSeverity;
  readonly status: IncidentStatus;
  readonly orgUnit: OrgUnitRefResponse;
  readonly owner: UserRefResponse;
  readonly reportedOn: string;
  readonly updatedAt: string;
  readonly description: string;
  readonly reportedBy: UserRefResponse;
  readonly resolutionSummary: string | null;
  readonly resolvedAt: string | null;
  readonly resolvedBy: UserRefResponse | null;
  readonly closedAt: string | null;
  readonly closedBy: UserRefResponse | null;
  readonly cancellationReason: string | null;
  readonly createdAt: string;
}

export function toIncidentResponse(record: IncidentRecord): IncidentResponse {
  return {
    id: record.id,
    code: record.code,
    title: record.title,
    severity: record.severity,
    status: record.status,
    orgUnit: { id: record.orgUnit.id, code: record.orgUnit.code, name: record.orgUnit.name },
    owner: toUserRef(record.owner),
    reportedOn: toDateOnly(record.reportedOn),
    updatedAt: record.updatedAt.toISOString(),
    description: record.description,
    reportedBy: toUserRef(record.reportedBy),
    resolutionSummary: record.resolutionSummary ?? null,
    resolvedAt: record.resolvedAt ? record.resolvedAt.toISOString() : null,
    resolvedBy: record.resolvedBy ? toUserRef(record.resolvedBy) : null,
    closedAt: record.closedAt ? record.closedAt.toISOString() : null,
    closedBy: record.closedBy ? toUserRef(record.closedBy) : null,
    cancellationReason: record.cancellationReason ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

function toUserRef(user: UserRefRecord): UserRefResponse {
  return { id: user.id, fullName: user.fullName };
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}
