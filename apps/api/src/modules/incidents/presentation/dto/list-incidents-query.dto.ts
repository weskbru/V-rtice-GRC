/**
 * 008-incidents-problems, US1 — matches `GET /incidents`'s query
 * parameters (`contracts/incidents.openapi.yaml`'s `listIncidents`
 * operation) exactly.
 *
 * `status`/`severity` use `style: form, explode: true` in the contract —
 * REPEATED query parameters (`?status=OPEN&status=CANCELLED`), mirroring
 * `ListProblemsQueryDto`'s own `toArray` convention — see that file's
 * header for why `enableImplicitConversion` alone does not solve this for
 * arrays either.
 */
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsOptional, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { USER_MESSAGES } from '../../../../shared/messages/user-messages';

import type { IncidentSortField } from '../../domain/ports/incident-repository.port';
import type { IncidentSeverity, IncidentStatus } from '@prisma/client';

const INCIDENT_STATUS_VALUES: readonly IncidentStatus[] = [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const INCIDENT_SEVERITY_VALUES: readonly IncidentSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const SORT_FIELD_VALUES: readonly IncidentSortField[] = [
  'code',
  'title',
  'severity',
  'status',
  'reportedOn',
  'updatedAt',
];

/** Reads `obj[key]` — the raw query value — never `value` (see this
 * file's header for why). A single value becomes a one-element array; an
 * already-repeated parameter (already an array, courtesy of Express/qs)
 * passes through unchanged; an absent parameter stays `undefined`. */
function toArray({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const raw = obj[key];
  if (raw === undefined) return undefined;
  return Array.isArray(raw) ? raw : [raw];
}

export class ListIncidentsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.incidentListQuery.page.isInt })
  @Min(1, { message: USER_MESSAGES.dto.incidentListQuery.page.isInt })
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: USER_MESSAGES.dto.incidentListQuery.pageSize.isInt })
  @Min(1, { message: USER_MESSAGES.dto.incidentListQuery.pageSize.isInt })
  @Max(100, { message: USER_MESSAGES.dto.incidentListQuery.pageSize.isInt })
  pageSize = 25;

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(INCIDENT_STATUS_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.incidentListQuery.status.isIn,
  })
  status?: readonly IncidentStatus[];

  @IsOptional()
  @Transform(toArray)
  @IsArray()
  @IsIn(INCIDENT_SEVERITY_VALUES, {
    each: true,
    message: USER_MESSAGES.dto.incidentListQuery.severity.isIn,
  })
  severity?: readonly IncidentSeverity[];

  @IsOptional()
  @MaxLength(200, { message: USER_MESSAGES.dto.incidentListQuery.search.maxLength })
  search?: string;

  @IsOptional()
  @IsUUID(undefined, { message: USER_MESSAGES.dto.incidentListQuery.orgUnitId.isUuid })
  orgUnitId?: string;

  @IsOptional()
  @IsIn(SORT_FIELD_VALUES, { message: USER_MESSAGES.dto.incidentListQuery.sort.isIn })
  sort: IncidentSortField = 'reportedOn';

  @IsOptional()
  @IsIn(['asc', 'desc'], { message: USER_MESSAGES.dto.incidentListQuery.direction.isIn })
  direction: 'asc' | 'desc' = 'asc';
}
