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
