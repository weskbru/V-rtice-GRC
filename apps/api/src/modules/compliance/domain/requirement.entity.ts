import { isFrameworkVersionEditable } from './framework-version-lifecycle';

import type { FrameworkVersionStatus } from '@prisma/client';

export function isRequirementEditable(parentVersionStatus: FrameworkVersionStatus): boolean {
  return isFrameworkVersionEditable(parentVersionStatus);
}
