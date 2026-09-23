import type { ControlStatus } from '@prisma/client';

export function isActiveForControlStatus(status: ControlStatus): boolean {
  return status !== 'RETIRED';
}
