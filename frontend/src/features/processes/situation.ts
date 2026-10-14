import { processes } from '@/lib/messages/processes';

import type { StatusVariant } from '@vertice/design-system/components';

export function processSituationVariant(isActive: boolean): StatusVariant {
  return processes.situationVariant[isActive ? 'active' : 'inactive'];
}

export function processSituationLabel(isActive: boolean): string {
  return processes.situationLabels[isActive ? 'active' : 'inactive'];
}
