import { reports } from '@/lib/messages/reports';

import type { StatusVariant } from '@vertice/design-system/components';

export function reportSituationVariant(isActive: boolean): StatusVariant {
  return reports.situationVariant[isActive ? 'active' : 'inactive'];
}

export function reportSituationLabel(isActive: boolean): string {
  return reports.situationLabels[isActive ? 'active' : 'inactive'];
}
