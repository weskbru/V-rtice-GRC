import { common } from '@/lib/messages/common';

import type { SeededRoleName } from '@/features/admin/types';

const DISPLAY_NAMES: Readonly<Record<SeededRoleName, string>> = common.roleDisplayNames;

export function roleDisplayName(name: string): string {
  return Object.hasOwn(DISPLAY_NAMES, name) ? DISPLAY_NAMES[name as SeededRoleName] : name;
}
