import { isActiveForControlStatus } from '../../domain/control.entity';

import type { ControlEffectiveness } from '../../domain/control-effectiveness.service';
import type { ControlRecord } from '../../domain/ports/control-repository.port';
import type { ControlFrequency, ControlNature, ControlStatus, ControlType } from '@prisma/client';

const DESCRIPTION_EXCERPT_LENGTH = 200;

export interface ControlUserRefResponse {
  readonly id: string;
  readonly fullName: string;
  readonly email: string;
}

export interface ControlOrgUnitRefResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
}

export interface ControlSummaryResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly descriptionExcerpt: string | null;
  readonly description: string | null;
  readonly orgUnit: ControlOrgUnitRefResponse | null;
  readonly owner: ControlUserRefResponse | null;
  readonly nature: ControlNature | null;
  readonly type: ControlType | null;
  readonly frequency: ControlFrequency | null;
  readonly status: ControlStatus;
  readonly isActive: boolean;
  readonly effectiveness: ControlEffectiveness;
  readonly version: number;
  readonly updatedAt: string;
}

export interface ControlDetailResponse extends ControlSummaryResponse {
  readonly description: string;
  readonly retiredAt: string | null;
  readonly retiredBy: ControlUserRefResponse | null;
  readonly retirementReason: string | null;
  readonly createdAt: string;
}

function toUserRefResponse(
  ref: { readonly id: string; readonly fullName: string; readonly email: string } | undefined,
): ControlUserRefResponse | null {
  return ref ? { id: ref.id, fullName: ref.fullName, email: ref.email } : null;
}

function toOrgUnitRefResponse(
  ref: { readonly id: string; readonly code: string; readonly name: string } | null,
): ControlOrgUnitRefResponse | null {
  return ref ? { id: ref.id, code: ref.code, name: ref.name } : null;
}

function toDescriptionExcerpt(description: string): string {
  return description.slice(0, DESCRIPTION_EXCERPT_LENGTH);
}

export function toControlDetailResponse(record: ControlRecord): ControlDetailResponse {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    descriptionExcerpt: toDescriptionExcerpt(record.description),
    orgUnit: toOrgUnitRefResponse(record.orgUnit),
    owner: toUserRefResponse(record.owner),
    nature: record.nature ?? null,
    type: record.type ?? null,
    frequency: record.frequency ?? null,
    status: record.status,
    isActive: isActiveForControlStatus(record.status),
    effectiveness: record.effectiveness,
    version: record.version,
    updatedAt: record.updatedAt.toISOString(),
    description: record.description,
    retiredAt: record.retiredAt ? record.retiredAt.toISOString() : null,
    retiredBy: toUserRefResponse(record.retiredBy),
    retirementReason: record.retirementReason ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}
