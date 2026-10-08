import type { FrameworkVersionStatus } from '@prisma/client';

export function canPublishFrameworkVersion(status: FrameworkVersionStatus): boolean {
  return status === 'DRAFT';
}

export function isFrameworkVersionEditable(status: FrameworkVersionStatus): boolean {
  return status === 'DRAFT';
}
