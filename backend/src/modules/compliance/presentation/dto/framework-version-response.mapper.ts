import type {
  FrameworkVersionFrameworkRef,
  FrameworkVersionRecord,
  FrameworkVersionUserRef,
} from '../../domain/ports/framework-version-repository.port';
import type { FrameworkVersionStatus } from '@prisma/client';

export interface FrameworkVersionResponse {
  readonly id: string;
  readonly framework: FrameworkVersionFrameworkRef;
  readonly label: string;
  readonly status: FrameworkVersionStatus;
  readonly publishedAt: string | null;
  readonly publishedBy: FrameworkVersionUserRef | null;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toFrameworkVersionResponse(
  record: FrameworkVersionRecord,
): FrameworkVersionResponse {
  return {
    id: record.id,
    framework: record.framework,
    label: record.label,
    status: record.status,
    publishedAt: record.publishedAt ? record.publishedAt.toISOString() : null,
    publishedBy: record.publishedBy ?? null,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
