/**
 * T030/004-compliance-management — maps `FrameworkRecord`
 * (`domain/framework.entity.ts`) to the wire shape
 * `contracts/compliance.openapi.yaml`'s `Framework` schema describes. This
 * is the ONLY place a `Framework` becomes this response body — no Prisma
 * model, and no `FrameworkRecord` either, is ever returned directly from
 * `FrameworkController` (ADR-009).
 */
import type { FrameworkRecord } from '../../domain/framework.entity';
import type { FrameworkOrigin } from '@prisma/client';

export interface FrameworkResponse {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export function toFrameworkResponse(record: FrameworkRecord): FrameworkResponse {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    origin: record.origin,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
