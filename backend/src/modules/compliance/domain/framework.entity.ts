import type { FrameworkOrigin } from '@prisma/client';

export interface FrameworkRecord {
  readonly id: string;
  readonly code: string;
  readonly name: string;
  readonly description: string;
  readonly origin: FrameworkOrigin;
  readonly version: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
