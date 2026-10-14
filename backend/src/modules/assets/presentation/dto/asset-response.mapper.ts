import type {
  AssetLinkedControlRecord,
  AssetLinkedRiskRecord,
  AssetOrgUnitRefRecord,
  AssetRecord,
  AssetSummaryRecord,
} from '../../domain/ports/asset-repository.port';

export interface AssetOrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AssetRiskRefResponse {
  readonly id: string;
  readonly code: string;
  readonly title: string;
}

export interface AssetControlRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface AssetSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly orgUnit: AssetOrgUnitRefResponse | null;
  readonly isActive: boolean;
  readonly updatedAt: string;
}

export interface AssetDetailResponse extends AssetSummaryResponse {
  readonly description: string | null;
  readonly risks: readonly AssetRiskRefResponse[];
  readonly controls: readonly AssetControlRefResponse[];
  readonly createdAt: string;
}

const DESCRIPTION_EXCERPT_LENGTH = 200;

function toOrgUnitRefResponse(
  ref: AssetOrgUnitRefRecord | undefined,
): AssetOrgUnitRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

export function toAssetSummaryResponse(row: AssetSummaryRecord): AssetSummaryResponse {
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

function toRiskRefResponse(ref: AssetLinkedRiskRecord): AssetRiskRefResponse {
  return { id: ref.id, code: ref.code, title: ref.title };
}

function toControlRefResponse(ref: AssetLinkedControlRecord): AssetControlRefResponse {
  return { id: ref.id, code: ref.code, name: ref.name };
}

export function toAssetDetailResponse(record: AssetRecord): AssetDetailResponse {
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
