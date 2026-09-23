import type {
  ProcessLinkedControlRecord,
  ProcessLinkedRiskRecord,
  ProcessOrgUnitRefRecord,
  ProcessRecord,
  ProcessSummaryRecord,
} from '../../domain/ports/process-repository.port';

export interface ProcessOrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProcessRiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface ProcessControlRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ProcessSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: ProcessOrgUnitRefResponse | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

export interface ProcessDetailResponse extends ProcessSummaryResponse {
  readonly description: string | null;
  readonly risks: readonly ProcessRiskRefResponse[];
  readonly controls: readonly ProcessControlRefResponse[];
  readonly createdAt: string;
}

const DESCRIPTION_EXCERPT_LENGTH = 200;

function toOrgUnitRefResponse(
  ref: ProcessOrgUnitRefRecord | undefined,
): ProcessOrgUnitRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

export function toProcessSummaryResponse(row: ProcessSummaryRecord): ProcessSummaryResponse {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    descriptionExcerpt: row.descriptionExcerpt,
    orgUnit: toOrgUnitRefResponse(row.orgUnit),
    isActive: row.isActive,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRiskRefResponse(ref: ProcessLinkedRiskRecord): ProcessRiskRefResponse {
  return { id: ref.id, code: ref.code, title: ref.title };
}

function toControlRefResponse(ref: ProcessLinkedControlRecord): ProcessControlRefResponse {
  return { id: ref.id, code: ref.code, name: ref.name };
}

export function toProcessDetailResponse(record: ProcessRecord): ProcessDetailResponse {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    descriptionExcerpt: record.description
      ? record.description.slice(0, DESCRIPTION_EXCERPT_LENGTH)
      : null,
    orgUnit: toOrgUnitRefResponse(record.orgUnit),
    isActive: record.isActive,
    updatedAt: record.updatedAt.toISOString(),
    description: record.description ?? null,
    risks: record.risks.map(toRiskRefResponse),
    controls: record.controls.map(toControlRefResponse),
    createdAt: record.createdAt.toISOString(),
  };
}
